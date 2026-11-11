import { randomUUID } from "node:crypto";
import type { State, Actor, balanceAdjustmentSchema } from "@hoosoo/shared";
import type { z } from "zod";
import { assert } from "../../utils/errors";
import { audit } from "../../common/audit";
import { settings } from "../../common/settings";
import { requireRole, scopedEmployee } from "../../common/authorization";

export function balance(s: State, employeeId: string, year: number) {
  const id = employeeId + "_" + year;
  return (
    s.leaveBalances[id] || {
      id,
      employeeId,
      year,
      allowance: settings(s).annualAllowance,
      used: 0,
    }
  );
}
export function persistBalance(
  s: State,
  employeeId: string,
  year: number,
  actorId: string,
) {
  const b = balance(s, employeeId, year);
  if (!s.leaveBalances[b.id]) {
    s.leaveBalances[b.id] = b;
    const id = "allocation_" + b.id;
    s.leaveBalanceTransactions[id] = {
      id,
      employeeId,
      year,
      amount: b.allowance,
      kind: "allocation",
      reason: "Hạn mức ban đầu theo cấu hình tại lần ghi nhận đầu tiên",
      actorId,
    };
  }
  return b;
}
export function adjustBalance(
  s: State,
  a: Actor,
  employeeId: string,
  input: z.infer<typeof balanceAdjustmentSchema>,
) {
  requireRole(a, ["Admin", "HR"]);
  scopedEmployee(s, a, employeeId);
  const b = persistBalance(s, employeeId, input.year, a.uid);
  assert(
    b.allowance + input.amount >= b.used,
    409,
    "BALANCE_BELOW_USED",
    "Hạn mức mới không thể nhỏ hơn số phép đã sử dụng.",
  );
  b.allowance += input.amount;
  const id = randomUUID();
  s.leaveBalanceTransactions[id] = {
    id,
    employeeId,
    year: input.year,
    amount: input.amount,
    kind: "adjustment",
    reason: input.reason,
    actorId: a.uid,
  };
  audit(
    s,
    a,
    "balance.adjusted",
    b.id,
    { amount: input.amount, allowance: b.allowance },
    input.reason,
  );
  return b;
}
