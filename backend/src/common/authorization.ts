import type {
  State,
  Actor,
  Employee,
  EmployeeView,
  Role,
} from "@hoosoo/shared";
import { assert, notFound } from "../utils/errors";
import { ORG_ID } from "../config/env";

export function actorFor(state: State, uid: string): Actor {
  const m = state.memberships[uid];
  assert(
    m?.active && m.orgId === ORG_ID,
    403,
    "ACCESS_DISABLED",
    "Tài khoản chưa được cấp quyền hoặc đã bị vô hiệu hóa.",
  );
  assert(
    state.employees[m.employeeId] &&
      state.employees[m.employeeId].status !== "terminated",
    403,
    "EMPLOYMENT_ENDED",
    "Hồ sơ đã kết thúc làm việc.",
  );
  return { uid, employeeId: m.employeeId, role: m.role, orgId: m.orgId };
}
export function requireRole(actor: Actor, roles: Role[]) {
  assert(
    roles.includes(actor.role),
    403,
    "FORBIDDEN",
    "Bạn không có quyền thực hiện thao tác này.",
  );
}
export function isHR(a: Actor) {
  return a.role === "Admin" || a.role === "HR";
}
export function inScope(s: State, a: Actor, e: Employee) {
  return (
    isHR(a) ||
    e.id === a.employeeId ||
    (a.role === "Manager" &&
      e.managerId === a.employeeId &&
      e.departmentId === s.employees[a.employeeId]?.departmentId)
  );
}
export function scopedEmployee(s: State, a: Actor, id: string) {
  const e = s.employees[id];
  if (!e || !inScope(s, a, e)) notFound();
  return e;
}
export function employeeView(e: Employee, a: Actor): EmployeeView {
  const { phone, address, uid, ...work } = e;
  return isHR(a) || a.employeeId === e.id
    ? { ...work, phone, address, ...(a.role === "Admin" ? { uid } : {}) }
    : work;
}
export function canApprove(s: State, a: Actor, employeeId: string) {
  return (
    a.employeeId !== employeeId &&
    (isHR(a) ||
      (a.role === "Manager" &&
        !!s.employees[employeeId] &&
        inScope(s, a, s.employees[employeeId])))
  );
}
