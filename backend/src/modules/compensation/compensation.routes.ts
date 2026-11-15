import { Router } from "express";
import { z } from "zod";
import {
  compensationSetupSchema,
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
