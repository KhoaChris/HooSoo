import { requireRole } from "../../common/authorization";
import { readState, mergeState } from "../../database/store";
import { adminBandWorkspace, saveAdminBand } from "./admin-band.service";
import { Router } from "express";
import { z } from "zod";
import {
  compensationSetupSchema,
  adminBandSchema,
  compensationActionSchema,
  idSchema,
} from "@hoosoo/shared";
import { handlers, context, param } from "../../routes/helpers";
import { validate } from "../../middleware/validate";
import { businessDate } from "../../utils/time";
import { compensationRead } from "./compensation.reads";
import {
  compensationPerson,
  saveCompensation,
  compensationAction,
} from "./compensation.service";
export const compensationRoutes = Router();
const { write } = handlers(compensationRoutes);
compensationRoutes.get("/compensation", async (req, res) => {
  const q = validate(
    z
      .object({
        scope: z.enum(["my", "team"]).default("my"),
        employeeId: idSchema.optional(),
      })
      .strict(),
    req.query,
  );
  const { s, a } = await context(res, [], true);
  const ids = await compensationRead(s, a, q.scope === "team", q.employeeId);
  res.json({
    people: ids.map((id) => compensationPerson(s, a, id)),
    asOf: businessDate(),
    ...(a.role === "Admin" && q.scope === "my"
      ? { adminBand: s.compensationBands.Admin ?? null }
      : {}),
  });
});
write("post", "/compensation/records", compensationSetupSchema, (s, a, input) =>
  saveCompensation(s, a, input),
);
write(
  "patch",
  "/compensation/records/:id",
  compensationSetupSchema,
  (s, a, input, req) => saveCompensation(s, a, input, param(req, "id")),
);
for (const action of ["publish", "cancel"] as const)
  write(
    "post",
    `/compensation/records/:id/${action}`,
    compensationActionSchema,
    (s, a, input, req) =>
      compensationAction(s, a, param(req, "id"), action, input),
  );

compensationRoutes.get("/compensation/admin-band", async (_req, res) => {
  const { s, a } = await context(res, [], true);
  requireRole(a, ["Admin"]);
  mergeState(
    s,
    await readState([], {
      compensationBands: { field: "role", value: "Admin" },
      compensationRecords: { field: "employeeId", value: a.employeeId },
    }),
  );
  res.json(adminBandWorkspace(s, a));
});
write("post", "/compensation/admin-band", adminBandSchema, (s, a, input) =>
  saveAdminBand(s, a, input),
);
