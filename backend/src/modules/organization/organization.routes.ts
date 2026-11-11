import { Router } from "express";
import { handlers, param } from "../../routes/helpers";
import { z } from "zod";
import { catalogSchema } from "@hoosoo/shared";
import { paginate } from "../../common/query";
import { settings } from "../../common/settings";
import { saveCatalog, catalogStatus } from "./organization.service";

export const organizationRoutes = Router();
const api = organizationRoutes;
const { get, write } = handlers(api);
for (const table of ["departments", "positions"] as const) {
  get("/" + table, [table], (s, _a, q) =>
    paginate(
      Object.values(s[table]).map((c) => ({
        ...c,
        employeeCount: Object.values(s.employees).filter(
          (e) =>
            e[table === "departments" ? "departmentId" : "positionId"] ===
              c.id && e.status !== "terminated",
        ).length,
      })),
      q,
    ),
  );
  write("post", "/" + table, catalogSchema, (s, a, input) =>
    saveCatalog(s, a, table, input),
  );
  write("patch", "/" + table + "/:id", catalogSchema, (s, a, input, req) =>
    saveCatalog(s, a, table, input, param(req, "id")),
  );
  write(
    "patch",
    "/" + table + "/:id/status",
    z.object({ active: z.boolean() }).strict(),
    (s, a, input, req) =>
      catalogStatus(s, a, table, param(req, "id"), input.active),
  );
}
get("/organization/tree", ["departments", "positions", "settings"], (s, a) => ({
  companyName: settings(s).companyName,
  departments: Object.values(s.departments)
    .filter((d) => d.active)
    .map((d) => ({
      ...d,
      employees: Object.values(s.employees)
        .filter((e) => e.departmentId === d.id && e.status !== "terminated")
        .sort(
          (a, b) =>
            Number(!!a.managerId) - Number(!!b.managerId) ||
            a.employeeCode.localeCompare(b.employeeCode),
        )
        .map((e) => ({
          id: e.id,
          name: e.name,
          employeeCode: e.employeeCode,
          positionName: s.positions[e.positionId]?.name,
          managerName: s.employees[e.managerId]?.name || "",
          self: e.id === a.employeeId,
        })),
    })),
}));
