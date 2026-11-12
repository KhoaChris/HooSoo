import { isHR, canManageEmployee } from "../../common/authorization";
import type { State, Actor, Query, BalanceView } from "@hoosoo/shared";
import { inScope } from "../../common/authorization";
import { matchEmployee } from "../../common/query";
import { businessDate } from "../../utils/time";
import { balance } from "./balances.service";

export function balanceList(s: State, a: Actor, q: Query): BalanceView[] {
  const year = q.year || Number(businessDate().slice(0, 4));
  return Object.values(s.employees)
    .filter(
      (e) =>
        inScope(s, a, e) &&
        matchEmployee(e, q) &&
        (q.mine !== "true" || e.id === a.employeeId),
    )
    .map((e) => {
      const b = balance(s, e.id, year);
      return {
        ...b,
        canAdjust: isHR(a) && canManageEmployee(s, a, e.id),
        employeeName: e.name,
        pending: Object.values(s.leaveRequests)
          .filter(
            (r) =>
              r.employeeId === e.id &&
              r.status === "pending" &&
              r.deductsBalance &&
              Number(r.startDate.slice(0, 4)) === year,
          )
          .reduce((n, r) => n + r.days, 0),
        available: b.allowance - b.used,
        transactions: Object.values(s.leaveBalanceTransactions)
          .filter((t) => t.employeeId === e.id && t.year === year)
          .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")),
      };
    });
}
