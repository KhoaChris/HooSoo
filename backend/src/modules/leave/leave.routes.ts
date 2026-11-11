import { Router } from "express";
import { handlers, param } from "../../routes/helpers";
import { z } from "zod";
import {
  leaveSchema,
  leaveTypeSchema,
  reasonSchema,
  balanceAdjustmentSchema,
} from "@hoosoo/shared";
import { paginate } from "../../common/query";
import { leaveList } from "./leave.queries";
import { balanceList } from "./balances.queries";
import { createLeave, transitionLeave } from "./leave.service";
import { adjustBalance } from "./balances.service";
import { saveLeaveType } from "./leave-types.service";
import { notFound } from "../../utils/errors";

export const leaveRoutes = Router();
const api = leaveRoutes;
const { get, write } = handlers(api);
get("/leave-types", ["leaveTypes"], (s, _a, q) =>
  paginate(Object.values(s.leaveTypes), q),
);
write("post", "/leave-types", leaveTypeSchema, (s, a, input) =>
  saveLeaveType(s, a, input),
);
write(
  "patch",
  "/leave-types/:leaveTypeId",
  leaveTypeSchema,
  (s, a, input, req) => saveLeaveType(s, a, input, param(req, "leaveTypeId")),
);
get("/leave-requests", ["leaveRequests"], (s, a, q) =>
  paginate(leaveList(s, a, q), q),
);
get("/leave-requests/:requestId", ["leaveRequests"], (s, a, q, req) => {
  const r = leaveList(s, a, { ...q, status: undefined }).find(
    (r) => r.id === param(req, "requestId"),
  );
  if (!r) notFound();
  return r;
});
write("post", "/leave-requests", leaveSchema, (s, a, input) =>
  createLeave(s, a, input),
);
for (const action of ["approve", "reject", "cancel"] as const)
  write(
    "post",
    "/leave-requests/:requestId/" + action,
    action === "reject"
      ? reasonSchema
      : z.object({ reason: z.string().max(1000).default("") }).strict(),
    (s, a, input, req) =>
      transitionLeave(s, a, param(req, "requestId"), action, input.reason),
  );
get(
  "/leave-balances",
  ["settings", "leaveBalances", "leaveRequests", "leaveBalanceTransactions"],
  (s, a, q) => paginate(balanceList(s, a, q), q),
);
write(
  "post",
  "/leave-balances/:employeeId/adjustments",
  balanceAdjustmentSchema,
  (s, a, input, req) => adjustBalance(s, a, param(req, "employeeId"), input),
);
