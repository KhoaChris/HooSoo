import { Router } from "express";
import { z } from "zod";
import {
  employmentSections,
  employmentTables,
  contractSchema,
  probationSchema,
  probationReviewSchema,
  employmentActionSchema,
  onboardingSchema,
  onboardingTaskSchema,
  onboardingTaskActionSchema,
} from "@hoosoo/shared";
import { handlers, context, param } from "../../routes/helpers";
import { validate } from "../../middleware/validate";
import { isHR, canManageEmployee } from "../../common/authorization";
import { employmentRead } from "./employment.reads";
import {
  canSeeEmployment,
  employmentView,
  saveContract,
  contractAction,
  saveProbation,
  assessProbation,
  probationAction,
  createOnboarding,
  addOnboardingTask,
  completeOnboardingTask,
  onboardingAction,
} from "./employment.service";
export const employmentRoutes = Router();
const { write } = handlers(employmentRoutes);
for (const section of employmentSections) {
  employmentRoutes.get(`/employment/${section}`, async (req, res) => {
    const q = validate(
      z.object({ scope: z.enum(["my", "team"]).default("my") }).strict(),
      req.query,
    );
    const { s, a } = await context(res, [], true);
    await employmentRead(s, a, section, q.scope === "team");
    const items = Object.values(s[employmentTables[section]])
      .filter(
        (r) =>
          (q.scope === "team" || r.employeeId === a.employeeId) &&
          canSeeEmployment(s, a, section, r),
      )
      .map((r) => employmentView(s, a, section, r))
      .sort((x, y) => (y.createdAt || "").localeCompare(x.createdAt || ""));
    res.json({
      items,
      canCreate: q.scope === "team" && isHR(a),
      people:
        q.scope === "team" && isHR(a)
          ? Object.values(s.employees)
              .filter(
                (e) =>
                  e.status !== "terminated" && canManageEmployee(s, a, e.id),
              )
              .map((e) => ({
                id: e.id,
                name: e.name,
                employeeCode: e.employeeCode,
                status: e.status,
              }))
          : [],
    });
  });
}
write("post", "/employment/contracts", contractSchema, (s, a, b) =>
  saveContract(s, a, b),
);
write("patch", "/employment/contracts/:id", contractSchema, (s, a, b, req) =>
  saveContract(s, a, b, param(req, "id")),
);
for (const action of ["activate", "acknowledge", "end", "cancel"])
  write(
    "post",
    `/employment/contracts/:id/${action}`,
    employmentActionSchema,
    (s, a, b, req) => contractAction(s, a, param(req, "id"), action, b),
  );
write("post", "/employment/probations", probationSchema, (s, a, b) =>
  saveProbation(s, a, b),
);
write("patch", "/employment/probations/:id", probationSchema, (s, a, b, req) =>
  saveProbation(s, a, b, param(req, "id")),
);
write(
  "post",
  "/employment/probations/:id/review",
  probationReviewSchema,
  (s, a, b, req) => assessProbation(s, a, param(req, "id"), b),
);
for (const action of ["self-review", "confirm", "extend", "decline", "return"])
  write(
    "post",
    `/employment/probations/:id/${action}`,
    employmentActionSchema,
    (s, a, b, req) => probationAction(s, a, param(req, "id"), action, b),
  );
write("post", "/employment/onboarding", onboardingSchema, (s, a, b) =>
  createOnboarding(s, a, b.employeeId, b.startDate),
);
write(
  "post",
  "/employment/onboarding/:id/tasks",
  onboardingTaskSchema,
  (s, a, b, req) => addOnboardingTask(s, a, param(req, "id"), b),
);
write(
  "post",
  "/employment/onboarding/:id/tasks/complete",
  onboardingTaskActionSchema,
  (s, a, b, req) => completeOnboardingTask(s, a, param(req, "id"), b),
);
for (const action of ["complete", "reopen"])
  write(
    "post",
    `/employment/onboarding/:id/${action}`,
    employmentActionSchema,
    (s, a, b, req) => onboardingAction(s, a, param(req, "id"), action, b),
  );
