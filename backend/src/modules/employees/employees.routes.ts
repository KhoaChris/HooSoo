import { supervisorRoles } from "@hoosoo/shared";
import { Router } from "express";
import { handlers, param } from "../../routes/helpers";
import { z } from "zod";
import { employeeSchema } from "@hoosoo/shared";
import {
  requireRole,
  scopedEmployee,
  employeeView,
} from "../../common/authorization";
import { paginate } from "../../common/query";
import { employeeList } from "./employees.queries";
import { saveEmployee } from "./employees.service";

export const employeesRoutes = Router();
const api = employeesRoutes;
const { get, write } = handlers(api);

get("/employees", [], (s, a, q) => {
  requireRole(a, supervisorRoles);
  return paginate(employeeList(s, a, q), q);
});
get("/employees/:employeeId", [], (s, a, _q, req) =>
  employeeView(scopedEmployee(s, a, param(req, "employeeId")), a, s),
);
get("/employees/:employeeId/history", ["auditLogs"], (s, a, q, req) => {
  const e = scopedEmployee(s, a, param(req, "employeeId"));
  return paginate(
    Object.values(s.auditLogs)
      .filter((l) => l.targetId === e.id && l.action.startsWith("employee."))
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")),
    q,
  );
});
write("post", "/employees", employeeSchema, (s, a, input) =>
  employeeView(saveEmployee(s, a, input), a, s),
);
write("patch", "/employees/:employeeId", employeeSchema, (s, a, input, req) =>
  employeeView(saveEmployee(s, a, input, param(req, "employeeId")), a, s),
);
write(
  "patch",
  "/employees/:employeeId/status",
  z.object({ status: z.enum(["probation", "active", "terminated"]) }).strict(),
  (s, a, input, req) => {
    const e = scopedEmployee(s, a, param(req, "employeeId"));
    const {
      id: _id,
      uid: _uid,
      createdAt: _ca,
      updatedAt: _ua,
      createdBy: _cb,
      ...fields
    } = e;
    return employeeView(
      saveEmployee(s, a, { ...fields, ...input }, e.id),
      a,
      s,
    );
  },
);
