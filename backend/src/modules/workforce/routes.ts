import { createHash } from "node:crypto";
import { command } from "../../common/command";
import { audit } from "../../common/audit";
import { storeDocumentObject, readDocumentObject } from "./document-storage";
import { documentEdit, validateDocumentFile } from "./documents.service";
import { Router } from "express";
import { z } from "zod";
import {
  timeRequestSchema,
  payrollSetupSchema,
  personnelChangeSchema,
  personnelDocumentSchema,
  announcementSchema,
  workforceActionSchema,
  employeeImportSchema,
  workforceDay,
  isSupervisorRole,
} from "@hoosoo/shared";
import { context, handlers, param } from "../../routes/helpers";
import { validate } from "../../middleware/validate";
import { readState, mergeState } from "../../database/store";
import { requireRole, isHR, employeeRole } from "../../common/authorization";
import { loadEmployeeAccess } from "../../common/access-state";
import { notFound } from "../../utils/errors";
import { workforceRead, directory } from "./reads";
import { allowed, payManage, manages } from "./core";
import { createTime, actTime, timeView } from "./time.service";
import { savePayroll, actPayroll, payrollView } from "./payroll.service";
import { saveChange, actChange, changeView } from "./changes.service";
import {
  saveDocument,
  archiveDocument,
  documentView,
  documentRead,
  downloadDocument,
  employmentLetter,
} from "./documents.service";
import {
  saveAnnouncement,
  actAnnouncement,
  announcementView,
  announcementVisible,
  acknowledgementReport,
} from "./announcements.service";
import { previewImport, commitImport } from "./import.service";
import { deadlines } from "./deadlines.service";
export const workforceRoutes = Router();
const { write } = handlers(workforceRoutes);
const scopeSchema = z.object({
  scope: z.enum(["my", "team"]).default("my"),
  period: z
    .string()
    .regex(/^20\d{2}-(0[1-9]|1[0-2])$/)
    .optional(),
});
workforceRoutes.get("/workforce/:section", async (req, res) => {
  const section = validate(
      z.enum(["time", "payroll", "changes", "documents", "announcements"]),
      param(req, "section"),
    ),
    q = validate(scopeSchema, req.query),
    { s, a } = await context(res, [], true),
    ids = await workforceRead(s, a, section, q.scope === "team");
  const people = ids
    .filter((id) =>
      section === "payroll"
        ? payManage(s, a, id)
        : section === "changes"
          ? manages(s, a, id)
          : true,
    )
    .map((id) => ({
      id,
      name: s.employees[id].name,
      employeeCode: s.employees[id].employeeCode,
      departmentId: s.employees[id].departmentId,
    }));
  let items: unknown[] = [];
  if (section === "time")
    items = Object.values(s.timeRequests)
      .filter((r) => ids.includes(r.employeeId))
      .map((r) => timeView(s, a, r));
  if (section === "payroll")
    items = Object.values(s.payrollStatements)
      .filter(
        (r) =>
          ids.includes(r.employeeId) &&
          (!q.period || r.period === q.period) &&
          (payManage(s, a, r.employeeId) ||
            ["published", "voided"].includes(r.status)),
      )
      .map((r) => payrollView(s, a, r));
  if (section === "changes")
    items = Object.values(s.personnelChanges)
      .filter(
        (r) =>
          ids.includes(r.employeeId) &&
          (manages(s, a, r.employeeId) ||
            ["approved", "applied"].includes(r.status)),
      )
      .map((r) => changeView(s, a, r));
  if (section === "documents")
    items = Object.values(s.personnelDocuments)
      .filter(
        (r) => ids.includes(r.employeeId) && documentRead(s, a, r.employeeId),
      )
      .map((r) => documentView(s, a, r));
  if (section === "announcements")
    items = Object.values(s.announcements)
      .filter((r) => announcementVisible(s, a, r))
      .sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) ||
          b.publishOn.localeCompare(a.publishOn),
      )
      .map((r) => announcementView(s, a, r));
  res.json({
    items,
    people,
    canCreate:
      section === "time"
        ? q.scope === "my"
        : section === "documents"
          ? q.scope === "my" || isHR(a)
          : section === "announcements"
            ? isHR(a)
            : people.length > 0,
    leaveTypes: Object.values(s.leaveTypes),
    schedule: s.settings.main?.schedule ?? null,
    departments: Object.values(s.departments),
    positions: Object.values(s.positions),
    managers:
      section === "changes"
        ? Object.values(s.employees)
            .filter(
              (e) =>
                e.status !== "terminated" &&
                isSupervisorRole(employeeRole(s, e.id) ?? "Employee"),
            )
            .map((e) => ({
              id: e.id,
              name: e.name,
              employeeCode: e.employeeCode,
              departmentId: e.departmentId,
            }))
        : [],
    balances: Object.values(s.leaveBalances).filter(
      (r) => r.employeeId === a.employeeId,
    ),
  });
});
write("post", "/workforce/time", timeRequestSchema, createTime);
for (const action of ["approve", "reject", "cancel"])
  write(
    "post",
    `/workforce/time/:id/${action}`,
    workforceActionSchema,
    (s, a, i, req) => actTime(s, a, param(req, "id"), action, i),
  );
write("post", "/workforce/payroll", payrollSetupSchema, savePayroll);
for (const action of [
  "submit",
  "return",
  "approve",
  "publish",
  "void",
  "reissue",
])
  write(
    "post",
    `/workforce/payroll/:id/${action}`,
    workforceActionSchema,
    (s, a, i, req) => actPayroll(s, a, param(req, "id"), action, i),
  );
write("post", "/workforce/changes", personnelChangeSchema, (s, a, i) =>
  saveChange(s, a, i),
);
write(
  "patch",
  "/workforce/changes/:id",
  personnelChangeSchema,
  (s, a, i, req) => saveChange(s, a, i, param(req, "id")),
);
for (const action of ["submit", "approve", "reject", "apply", "cancel"])
  write(
    "post",
    `/workforce/changes/:id/${action}`,
    workforceActionSchema,
    (s, a, i, req) => actChange(s, a, param(req, "id"), action, i),
  );
for (const [method, path] of [
  ["post", "/workforce/documents"],
  ["patch", "/workforce/documents/:id"],
] as const)
  workforceRoutes[method](path, async (req, res) => {
    const input = validate(personnelDocumentSchema, req.body),
      id = method === "patch" ? param(req, "id") : undefined,
      key = validate(
        z.string().regex(/^[A-Za-z0-9_-]{8,100}$/),
        req.header("Idempotency-Key"),
      ),
      { s, a } = await context(res, [], true);
    mergeState(
      s,
      await readState(
        [],
        {
          employees: { ids: [input.employeeId] },
          ...(id ? { personnelDocuments: { ids: [id] } } : {}),
        },
        { fresh: true },
      ),
    );
    await loadEmployeeAccess((p) => readState([], p, { fresh: true }), s, [
      input.employeeId,
    ]);
    allowed(documentEdit(s, a, input));
    // Permission and file validation precede private storage; command validates version atomically.
    const objectKey = createHash("sha256")
      .update(a.uid + "|" + key + "|" + input.data)
      .digest("hex");
    validateDocumentFile(input);
    await storeDocumentObject(objectKey, Buffer.from(input.data, "base64"));
    const result = await command(
      a.uid,
      key,
      req.method + " " + req.path,
      input,
      (state, actor) => saveDocument(state, actor, input, id, objectKey),
    );
    res.json(result);
  });
write(
  "post",
  "/workforce/documents/:id/archive",
  workforceActionSchema,
  (s, a, i, req) => archiveDocument(s, a, param(req, "id"), i),
);
write("post", "/workforce/announcements", announcementSchema, (s, a, i) =>
  saveAnnouncement(s, a, i),
);
write(
  "patch",
  "/workforce/announcements/:id",
  announcementSchema,
  (s, a, i, req) => saveAnnouncement(s, a, i, param(req, "id")),
);
for (const action of ["publish", "archive", "acknowledge"])
  write(
    "post",
    `/workforce/announcements/:id/${action}`,
    workforceActionSchema,
    (s, a, i, req) => actAnnouncement(s, a, param(req, "id"), action, i),
  );
workforceRoutes.get(
  "/workforce/announcements/:id/receipts",
  async (req, res) => {
    const { s, a } = await context(res, [], true);
    requireRole(a, ["Admin", "HR"]);
    const id = param(req, "id");
    mergeState(
      s,
      await readState([], {
        announcements: { ids: [id] },
        employees: true,
        announcementReceipts: { field: "announcementId", value: id },
      }),
    );
    res.json(acknowledgementReport(s, a, id));
  },
);
workforceRoutes.post("/workforce/documents/:id/download", async (req, res) => {
  const id = param(req, "id"),
    input = validate(
      z.object({ fileVersion: z.number().int().positive() }).strict(),
      req.body,
    );
  const file = await command(
    res.locals.uid,
    req.header("Idempotency-Key"),
    req.method + " " + req.path,
    input,
    (s, a) => {
      const f = downloadDocument(s, a, id, input.fileVersion);
      audit(
        s,
        a,
        "workforce.document_downloaded",
        id,
        { fileVersion: f.version },
        "",
      );
      return f;
    },
  );
  const data = await readDocumentObject(file.objectKey, file.sha256);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
  );
  res.type(file.mime).send(data);
});
workforceRoutes.get("/workforce/letters/:id", async (req, res) => {
  const { s, a } = await context(res, [], true),
    id = param(req, "id");
  mergeState(
    s,
    await readState([], { internalRequests: { ids: [id] } }, { fresh: true }),
  );
  const r = s.internalRequests[id];
  if (!r) notFound();
  mergeState(
    s,
    await readState(
      [],
      {
        employees: { ids: [r.employeeId] },
        departments: true,
        positions: true,
        settings: { ids: ["main"] },
      },
      { fresh: true },
    ),
  );
  await loadEmployeeAccess((p) => readState([], p, { fresh: true }), s, [
    r.employeeId,
  ]);
  res.json(employmentLetter(s, a, id));
});
const windowSchema = z
  .object({
    start: workforceDay,
    end: workforceDay,
    scope: z.enum(["my", "team"]).default("my"),
  })
  .refine(
    (v) =>
      v.end >= v.start &&
      Date.parse(v.end) - Date.parse(v.start) <= 93 * 86400000,
    "Chọn khoảng ngày tối đa 93 ngày",
  );
workforceRoutes.get("/workforce/calendar/deadlines", async (req, res) => {
  const q = validate(windowSchema, req.query),
    { s, a } = await context(res, [], true);
  await workforceRead(s, a, "deadlines", q.scope === "team");
  res.json(deadlines(s, a, q.start, q.end));
});
workforceRoutes.post("/workforce/imports/preview", async (req, res) => {
  const input = validate(employeeImportSchema, req.body),
    { s, a } = await context(res, [], true);
  requireRole(a, ["Admin", "HR"]);
  await directory((p) => readState([], p, { fresh: true }), s, a, true);
  mergeState(
    s,
    await readState([], {
      departments: true,
      positions: true,
      employeeSequences: { ids: ["main"] },
    }),
  );
  res.json(previewImport(s, a, input.rows));
});
write("post", "/workforce/imports/commit", employeeImportSchema, commitImport);

workforceRoutes.get(
  "/workforce/changes/employee/:id/options",
  async (req, res) => {
    const { s, a } = await context(res, [], true),
      id = param(req, "id");
    mergeState(
      s,
      await readState([], { employees: { ids: [id] } }, { fresh: true }),
    );
    await loadEmployeeAccess((p) => readState([], p, { fresh: true }), s, [id]);
    allowed(manages(s, a, id));
    mergeState(
      s,
      await readState([], {
        compensationRecords: { field: "employeeId", value: id },
        employmentContracts: { field: "employeeId", value: id },
      }),
    );
    res.json({
      salaries: Object.values(s.compensationRecords)
        .filter((r) => r.status === "published")
        .map((r) => ({ id: r.id, label: r.effectiveDate })),
      contracts: Object.values(s.employmentContracts)
        .filter((r) => r.status === "active")
        .map((r) => ({ id: r.id, label: r.title })),
    });
  },
);
