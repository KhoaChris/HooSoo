import { validate } from "../../middleware/validate";
import { Router } from "express";
import { handlers, param } from "../../routes/helpers";
import { z } from "zod";
import { profileSchema, userSchema, roles } from "@hoosoo/shared";
import { requireRole, employeeView } from "../../common/authorization";
import { audit } from "../../common/audit";
import { settings } from "../../common/settings";
import { protectAdmin } from "./accounts.policy";
import { provisionAccount } from "./accounts.service";
import { assert, notFound } from "../../utils/errors";

export const accountsRoutes = Router();
const api = accountsRoutes;
const { get, write } = handlers(api);
get("/me", ["settings"], (s, a) => ({
  actor: a,
  employee: employeeView(s.employees[a.employeeId], a, s),
  companyName: settings(s).companyName,
}));
write("patch", "/me/profile", profileSchema, (s, a, input) => {
  const e = s.employees[a.employeeId];
  Object.assign(e, input);
  audit(s, a, "profile.updated", e.id, { fields: Object.keys(input) });
  return employeeView(e, a, s);
});
get("/users", ["memberships", "accountJobs"], (s, a) => {
  requireRole(a, ["Admin"]);
  return {
    items: Object.values(s.memberships).map((m) => ({
      ...m,
      name: s.employees[m.employeeId]?.name,
    })),
    jobs: Object.values(s.accountJobs).filter((j) => j.status !== "complete"),
  };
});
api.post("/users", async (req, res) => {
  const input = validate(userSchema, req.body);
  res.json(
    await provisionAccount(
      res.locals.uid,
      input,
      req.header("Idempotency-Key") || "",
    ),
  );
});
write(
  "patch",
  "/users/:uid/role",
  z.object({ role: z.enum(roles) }).strict(),
  (s, a, input, req) => {
    requireRole(a, ["Admin"]);
    const uid = param(req, "uid"),
      m = s.memberships[uid];
    if (!m) notFound();
    if (m.active && m.role === "Admin" && input.role !== "Admin")
      protectAdmin(s, uid);
    const before = m.role;
    m.role = input.role;
    audit(s, a, "account.role", uid, { before, after: m.role });
    return m;
  },
);
write(
  "patch",
  "/users/:uid/status",
  z.object({ active: z.boolean() }).strict(),
  (s, a, input, req) => {
    requireRole(a, ["Admin"]);
    const uid = param(req, "uid"),
      m = s.memberships[uid];
    if (!m) notFound();
    if (!input.active && m.active && m.role === "Admin") protectAdmin(s, uid);
    if (input.active)
      assert(
        s.employees[m.employeeId]?.status !== "terminated",
        409,
        "EMPLOYMENT_ENDED",
        "Hồ sơ đã nghỉ việc.",
      );
    m.active = input.active;
    audit(s, a, "account.status", uid, input);
    return m;
  },
);
