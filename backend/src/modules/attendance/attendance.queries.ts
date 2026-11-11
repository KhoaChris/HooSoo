import type { State, Actor, Query, AttendanceView } from "@hoosoo/shared";
import { inScope } from "../../common/authorization";
import { matchesDates, matchEmployee } from "../../common/query";
import { attendanceMetrics } from "../../utils/time";

export function attendanceList(s: State, a: Actor, q: Query): AttendanceView[] {
  return Object.values(s.attendanceRecords)
    .filter((r) => {
      const e = s.employees[r.employeeId];
      return (
        e &&
        inScope(s, a, e) &&
        matchEmployee(e, q) &&
        matchesDates(r.date, q) &&
        (q.mine !== "true" || e.id === a.employeeId)
      );
    })
    .map((r) => ({
      ...r,
      ...attendanceMetrics(r),
      employeeName: s.employees[r.employeeId].name,
      employeeCode: s.employees[r.employeeId].employeeCode,
      departmentId: s.employees[r.employeeId].departmentId,
      leaveConflict: Object.values(s.leaveRequests).some(
        (l) =>
          l.employeeId === r.employeeId &&
          l.status === "approved" &&
          l.workDates.includes(r.date),
      ),
    }))
    .filter(
      (r) =>
        !q.status || (q.status === "late" ? r.late : r.status === q.status),
    )
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        a.employeeCode.localeCompare(b.employeeCode),
    );
}
