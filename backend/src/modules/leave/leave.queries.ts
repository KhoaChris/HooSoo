import { canManageEmployee } from "../../common/authorization";
import type { State, Actor, Query, LeaveView } from "@hoosoo/shared";
import { inScope, canApprove, isHR } from "../../common/authorization";
import { matchEmployee } from "../../common/query";

export function leaveList(s: State, a: Actor, q: Query): LeaveView[] {
  return Object.values(s.leaveRequests)
    .filter((r) => {
      const e = s.employees[r.employeeId];
      return (
        e &&
        inScope(s, a, e) &&
        matchEmployee(e, q) &&
        (!q.status || r.status === q.status) &&
        (!q.startDate || r.endDate >= q.startDate) &&
        (!q.endDate || r.startDate <= q.endDate) &&
        (q.mine !== "true" || e.id === a.employeeId) &&
        (q.approvals !== "true" || canApprove(s, a, e.id))
      );
    })
    .map((r) => ({
      ...r,
      employeeName: s.employees[r.employeeId].name,
      employeeCode: s.employees[r.employeeId].employeeCode,
      departmentId: s.employees[r.employeeId].departmentId,
      canApprove: r.status === "pending" && canApprove(s, a, r.employeeId),
      canCancel:
        (r.status === "pending" &&
          (r.employeeId === a.employeeId ||
            (isHR(a) && canManageEmployee(s, a, r.employeeId)))) ||
        (r.status === "approved" &&
          isHR(a) &&
          canManageEmployee(s, a, r.employeeId)),
    }))
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}
