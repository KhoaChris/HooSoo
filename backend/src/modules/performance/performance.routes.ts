import { Router } from "express";
import { z } from "zod";
import {
  performanceReportSchema,
  performanceSetupSchema,
  performanceSaveSchema,
  performanceActionSchema,
} from "@hoosoo/shared";
import { handlers, context, param } from "../../routes/helpers";
import { validate } from "../../middleware/validate";
import {
  managesPerformance,
  canSeeReport,
  performanceActor,
} from "./performance-access";
import { reportView, submitReport, decideReport } from "./performance-reports";
import { performanceRead } from "./performance.reads";
import {
  canSeePerformance,
  performanceView,
  setupPerformance,
  savePerformance,
  performanceAction,
} from "./performance.service";
export const performanceRoutes = Router();
const { write } = handlers(performanceRoutes);
performanceRoutes.get("/performance/reviews", async (req, res) => {
  const q = validate(
    z.object({ scope: z.enum(["my", "team"]).default("my") }).strict(),
    req.query,
  );
  const { s, a } = await context(res, [], true);
  await performanceRead(s, a, q.scope === "team");
  res.json({
    items: Object.values(s.performanceReviews)
      .filter(
        (r) =>
          (q.scope === "team" || r.employeeId === a.employeeId) &&
          canSeePerformance(s, a, r),
      )
      .map((r) => performanceView(s, a, r))
      .sort((x, y) => (y.createdAt || "").localeCompare(x.createdAt || "")),
    canCreate: q.scope === "team",
    reports:
      q.scope === "team"
        ? Object.values(s.performanceReports)
            .filter((r) => canSeeReport(s, a, r))
            .map((r) => reportView(s, a, r))
            .sort((x, y) =>
              (y.createdAt || "").localeCompare(x.createdAt || ""),
            )
        : [],
    reportRecipients:
      q.scope === "team"
        ? Object.values(s.employees).flatMap((e) => {
            const recipient = performanceActor(s, e.id);
            return recipient && managesPerformance(s, recipient, a.employeeId)
              ? [
                  {
                    id: e.id,
                    name: e.name,
                    employeeIds: Object.values(s.employees)
                      .filter(
                        (target) =>
                          managesPerformance(s, a, target.id) &&
                          managesPerformance(s, recipient, target.id),
                      )
                      .map((target) => target.id),
                  },
                ]
              : [];
          })
        : [],
    people:
      q.scope === "team"
        ? Object.values(s.employees)
            .filter(
              (e) =>
                e.id !== a.employeeId &&
                e.status !== "terminated" &&
                managesPerformance(s, a, e.id),
            )
            .map((e) => ({
              id: e.id,
              name: e.name,
              employeeCode: e.employeeCode,
            }))
        : [],
  });
});
write("post", "/performance/reviews", performanceSetupSchema, (s, a, b) =>
  setupPerformance(s, a, b),
);
write(
  "patch",
  "/performance/reviews/:id",
  performanceSetupSchema,
  (s, a, b, r) => setupPerformance(s, a, b, param(r, "id")),
);
for (const phase of ["self", "manager"] as const)
  write(
    "post",
    `/performance/reviews/:id/${phase}`,
    performanceSaveSchema,
    (s, a, b, r) => savePerformance(s, a, param(r, "id"), phase, b),
  );
for (const action of [
  "launch",
  "finalize",
  "return_self",
  "return_manager",
  "acknowledge",
  "cancel",
] as const)
  write(
    "post",
    `/performance/reviews/:id/${action}`,
    performanceActionSchema,
    (s, a, b, r) => performanceAction(s, a, param(r, "id"), action, b),
  );

write("post", "/performance/reports", performanceReportSchema, (s, a, b) =>
  submitReport(s, a, b),
);
for (const action of ["finalize", "return"] as const)
  write(
    "post",
    `/performance/reports/:id/${action}`,
    performanceActionSchema,
    (s, a, b, r) => decideReport(s, a, param(r, "id"), action, b),
  );
