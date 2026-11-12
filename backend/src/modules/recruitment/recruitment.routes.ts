import { isSupervisorRole } from "@hoosoo/shared";
import { supervisorRoles } from "@hoosoo/shared";
import { Router, raw } from "express";
import { createHash } from "node:crypto";
import {
  recruitmentJobSchema,
  candidateSchema,
  candidateEditSchema,
  interviewSchema,
  evaluationSchema,
  candidateTransitionSchema,
  reviewSchema,
} from "@hoosoo/shared";
import { handlers, context, param } from "../../routes/helpers";
import { readState, mergeState } from "../../database/store";
import { requireRole, isHR } from "../../common/authorization";
import { assert } from "../../utils/errors";
import { command } from "../../common/command";
import * as service from "./recruitment.service";
export const recruitmentRoutes = Router();
const { write } = handlers(recruitmentRoutes);
recruitmentRoutes.get("/recruitment/jobs", async (_req, res) => {
  const { s, a } = await context(res, [], true);
  requireRole(a, supervisorRoles);
  const self = s.employees[a.employeeId];
  mergeState(
    s,
    await readState(
      [],
      {
        recruitmentJobs: isHR(a)
          ? true
          : { field: "hiringManagerId", value: a.employeeId },
      },
      { fresh: !isHR(a) },
    ),
  );
  mergeState(
    s,
    await readState([], {
      departments: true,
      employees: true,
      memberships: true,
    }),
  );
  s.employees[a.employeeId] = self;
  // Only work identities are exposed; personal contact fields and auth UIDs stay private.
  res.json({
    items: Object.values(s.recruitmentJobs).filter((j) =>
      service.canAccessJob(s, a, j),
    ),
    departments: Object.values(s.departments)
      .filter((d) => d.active)
      .map((d) => ({ id: d.id, name: d.name })),
    reviewers: Object.values(s.employees)
      .filter(
        (e) =>
          e.status !== "terminated" &&
          Object.values(s.memberships).some(
            (m) =>
              m.employeeId === e.id && m.active && isSupervisorRole(m.role),
          ),
      )
      .map((e) => ({
        id: e.id,
        name: e.name,
        departmentId: e.departmentId,
        hr: Object.values(s.memberships).some(
          (m) =>
            m.employeeId === e.id &&
            m.active &&
            ["Admin", "HR"].includes(m.role),
        ),
      })),
  });
});
recruitmentRoutes.get("/recruitment/jobs/:id/candidates", async (req, res) => {
  const { s, a } = await context(res, [], true),
    id = param(req, "id");
  requireRole(a, supervisorRoles);
  mergeState(
    s,
    await readState(
      [],
      { recruitmentJobs: { ids: [id] } },
      { fresh: !isHR(a) },
    ),
  );
  service.jobFor(s, a, id);
  mergeState(
    s,
    await readState([], { candidates: { field: "jobId", value: id } }),
  );
  res.json({ items: Object.values(s.candidates) });
});
write("post", "/recruitment/jobs", recruitmentJobSchema, (s, a, input) =>
  service.saveJob(s, a, input),
);
write(
  "patch",
  "/recruitment/jobs/:id",
  recruitmentJobSchema,
  (s, a, input, req) => service.saveJob(s, a, input, param(req, "id")),
);
write("post", "/recruitment/candidates", candidateSchema, (s, a, input) =>
  service.createCandidate(s, a, input),
);
write(
  "patch",
  "/recruitment/candidates/:id",
  candidateEditSchema,
  (s, a, input, req) => service.editCandidate(s, a, param(req, "id"), input),
);
write(
  "post",
  "/recruitment/candidates/:id/evaluate",
  evaluationSchema,
  (s, a, input, req) =>
    service.evaluateCandidate(s, a, param(req, "id"), input),
);
write(
  "post",
  "/recruitment/candidates/:id/move",
  candidateTransitionSchema,
  (s, a, input, req) => service.moveCandidate(s, a, param(req, "id"), input),
);
write(
  "post",
  "/recruitment/candidates/:id/interview",
  interviewSchema,
  (s, a, input, req) =>
    service.scheduleInterview(s, a, param(req, "id"), input),
);
write(
  "post",
  "/recruitment/candidates/:id/confirm-interview",
  reviewSchema,
  (s, a, input, req) => service.confirmInterview(s, a, param(req, "id"), input),
);
for (const decision of ["hire", "reject", "direct-hire"] as const)
  write(
    "post",
    `/recruitment/candidates/:id/${decision}`,
    reviewSchema,
    (s, a, input, req) =>
      service.decideCandidate(s, a, param(req, "id"), decision, input),
  );
recruitmentRoutes.post(
  "/recruitment/candidates/:id/cv",
  raw({ type: "application/pdf", limit: "2mb" }),
  async (req, res) => {
    const id = param(req, "id"),
      pdf = req.body as Buffer;
    assert(Buffer.isBuffer(pdf), 400, "PDF_REQUIRED", "Chọn tệp PDF.");
    const version = Number(req.header("X-Record-Version"));
    assert(
      Number.isInteger(version) && version > 0,
      400,
      "VERSION_REQUIRED",
      "Thiếu phiên bản hồ sơ.",
    );
    let name = "CV.pdf";
    try {
      name = decodeURIComponent(req.header("X-File-Name") ?? name);
    } catch {
      /* use safe default */
    }
    const body = {
      version,
      name,
      sha256: createHash("sha256").update(pdf).digest("hex"),
    };
    res.json(
      await command(
        res.locals.uid,
        req.header("Idempotency-Key"),
        req.method + " " + req.path,
        body,
        (s, a) => service.saveCV(s, a, id, pdf, name, version),
      ),
    );
  },
);
recruitmentRoutes.get("/recruitment/candidates/:id/cv", async (req, res) => {
  const { s, a } = await context(res, [], true),
    id = param(req, "id");
  requireRole(a, supervisorRoles);
  mergeState(s, await readState([], { candidates: { ids: [id] } }));
  const candidate = s.candidates[id];
  if (candidate)
    mergeState(
      s,
      await readState(
        [],
        { recruitmentJobs: { ids: [candidate.jobId] } },
        { fresh: !isHR(a) },
      ),
    );
  const c = service.candidateFor(s, a, id);
  assert(c.cv, 404, "CV_NOT_FOUND", "Hồ sơ chưa có CV đính kèm.");
  mergeState(
    s,
    await readState([], {
      candidateFiles: {
        ids: Array.from({ length: c.cv.chunks }, (_, i) => `${id}_${i}`),
      },
    }),
  );
  const pdf = Buffer.concat(
    Array.from({ length: c.cv.chunks }, (_, i) =>
      Buffer.from(s.candidateFiles[`${id}_${i}`]?.data ?? "", "base64"),
    ),
  );
  assert(
    pdf.length === c.cv.size &&
      createHash("sha256").update(pdf).digest("hex") === c.cv.sha256,
    503,
    "CV_INCOMPLETE",
    "Không tải được CV đầy đủ. Vui lòng thử lại.",
  );
  res
    .set({
      "Content-Type": "application/pdf",
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="CV.pdf"; filename*=UTF-8''${encodeURIComponent(c.cv.name)}`,
    })
    .send(pdf);
});
