import { Router } from "express";
import { z } from "zod";
import {
  serviceSections,
  serviceSetupSchema,
  serviceActionSchema,
  serviceTaskSchema,
  serviceTaskActionSchema,
  serviceActions,
} from "@hoosoo/shared";
import { context, handlers, param } from "../../routes/helpers";
import { validate } from "../../middleware/validate";
import { isHR } from "../../common/authorization";
import { servicesRead } from "./employee-services.reads";
import {
  serviceVisible,
  serviceManager,
  serviceView,
  saveService,
  actService,
  addServiceTask,
  updateServiceTask,
} from "./employee-services.service";
export const employeeServicesRoutes = Router();
const { write } = handlers(employeeServicesRoutes);
employeeServicesRoutes.get("/employee-services", async (req, res) => {
  const q = validate(
    z
      .object({
        section: z.enum(serviceSections),
        scope: z.enum(["my", "team"]).default("my"),
      })
      .strict(),
    req.query,
  );
  const { s, a } = await context(res, [], true);
  const team = q.scope === "team";
  await servicesRead(s, a, q.section, team);
  const people = Object.values(s.employees).filter(
    (e) => e.status !== "terminated" && serviceManager(s, a, e.id),
  );
  res.json({
    items: Object.values(s.employeeServices)
      .filter(
        (r) =>
          r.section === q.section &&
          (team || r.employeeId === a.employeeId) &&
          serviceVisible(s, a, r),
      )
      .map((r) => serviceView(s, a, r))
      .sort((x, y) => (y.createdAt || "").localeCompare(x.createdAt || "")),
    canCreate: team && isHR(a),
    people:
      team && isHR(a)
        ? people.map((e) => ({
            id: e.id,
            name: e.name,
            employeeCode: e.employeeCode,
          }))
        : [],
    requests:
      team && isHR(a)
        ? Object.values(s.internalRequests)
            .filter(
              (r) =>
                r.status === "approved" &&
                r.kind ===
                  (q.section === "assets" ? "equipment" : "training") &&
                people.some((e) => e.id === r.employeeId) &&
                Object.values(s.employeeServices).filter(
                  (item) =>
                    item.sourceRequestId === r.id &&
                    item.status !== "cancelled",
                ).length < (r.kind === "equipment" ? (r.quantity ?? 1) : 1),
            )
            .map((r) => ({
              id: r.id,
              employeeId: r.employeeId,
              title: r.title,
              kind: r.kind,
              resource: r.resource || "",
            }))
        : [],
  });
});
write("post", "/employee-services", serviceSetupSchema, (s, a, b) =>
  saveService(s, a, b),
);
write("patch", "/employee-services/:id", serviceSetupSchema, (s, a, b, req) =>
  saveService(s, a, b, param(req, "id")),
);
for (const action of serviceActions)
  write(
    "post",
    `/employee-services/:id/${action}`,
    serviceActionSchema,
    (s, a, b, req) => actService(s, a, param(req, "id"), action, b),
  );
write(
  "post",
  "/employee-services/:id/tasks",
  serviceTaskSchema,
  (s, a, b, req) => addServiceTask(s, a, param(req, "id"), b),
);
write(
  "post",
  "/employee-services/:id/task",
  serviceTaskActionSchema,
  (s, a, b, req) => updateServiceTask(s, a, param(req, "id"), b),
);
