import type { State, Actor, Query } from "@hoosoo/shared";
import { matchesDates } from "../../common/query";
import { businessDate } from "../../utils/time";
import { employeeList } from "../employees/employees.queries";
import { attendanceList } from "../attendance/attendance.queries";
import { leaveList } from "../leave/leave.queries";
import { balanceList } from "../leave/balances.queries";

export function dashboard(s: State, a: Actor, q: Query) {
  const employees = employeeList(s, a, { ...q, status: undefined });
  const today = businessDate();
  const attend = attendanceList(s, a, {
    ...q,
    startDate: today,
    endDate: today,
  });
  const leaves = leaveList(s, a, q);
  return {
    scope:
      a.role === "Employee"
        ? "Cá nhân"
        : a.role === "Manager"
          ? "Nhóm phụ trách"
          : "Toàn doanh nghiệp",
    asOf: new Date().toISOString(),
    startDate: q.startDate || null,
    endDate: q.endDate || null,
    employeeCount: employees.filter((e) => e.status !== "terminated").length,
    departmentCount: Object.values(s.departments).filter((d) => d.active)
      .length,
    newHires: employees.filter((e) => matchesDates(e.hireDate, q)).length,
    todayAttendance: attend.length,
    pendingLeaves: leaves.filter((l) => l.status === "pending").length,
    departments: Object.values(s.departments).map((d) => ({
      id: d.id,
      name: d.name,
      count: employees.filter(
        (e) => e.departmentId === d.id && e.status !== "terminated",
      ).length,
    })),
    recentLeaves: leaves.slice(0, 5),
    today: attend,
    balances: balanceList(s, a, { ...q, mine: "true" }),
  };
}
