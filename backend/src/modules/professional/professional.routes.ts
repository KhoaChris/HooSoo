import { Router } from "express";
import {
  allowedWorkKinds,
  professionalRoles,
  isSupervisorRole,
  workItemSchema,
  workActionSchema,
  workActions,
} from "@hoosoo/shared";
import { handlers, context, param } from "../../routes/helpers";
import { inScope, employeeRole } from "../../common/authorization";
import { professionalRead } from "./professional.reads";
import {
  canSeeWork,
  workView,
  saveWork,
  transitionWork,
} from "./professional.service";
export const professionalRoutes = Router();
const { write } = handlers(professionalRoutes);
professionalRoutes.get("/professional/workspace", async (_req, res) => {
  const { s, a } = await context(res, [], true);
  await professionalRead(s, a);
  res.json({
    items: Object.values(s.workItems)
      .filter((w) => canSeeWork(s, a, w))
      .map((w) => workView(s, a, w))
      .sort((x, y) => y.createdAt!.localeCompare(x.createdAt!)),
    kinds: allowedWorkKinds(a.role),
    canAssign: isSupervisorRole(a.role),
    departments: Object.values(s.departments)
      .filter(
        (d) =>
          d.active &&
          (a.role === "Admin" ||
            d.id === s.employees[a.employeeId].departmentId),
      )
      .map((d) => ({ id: d.id, name: d.name })),
    people: Object.values(s.employees)
      .filter(
        (e) =>
          e.status !== "terminated" &&
          professionalRoles.includes(employeeRole(s, e.id)!) &&
          (inScope(s, a, e) ||
            e.id === s.employees[a.employeeId].managerId ||
            (a.role !== "Admin" && employeeRole(s, e.id) === "Admin")),
      )
      .map((e) => ({
        id: e.id,
        name: e.name,
        departmentId: e.departmentId,
        role: employeeRole(s, e.id),
      })),
  });
});
write("post", "/professional/work-items", workItemSchema, (s, a, b) =>
  saveWork(s, a, b),
);
write("patch", "/professional/work-items/:id", workItemSchema, (s, a, b, req) =>
  saveWork(s, a, b, param(req, "id")),
);
for (const action of workActions)
  write(
    "post",
    `/professional/work-items/:id/${action}`,
    workActionSchema,
    (s, a, b, req) => transitionWork(s, a, param(req, "id"), action, b),
  );
