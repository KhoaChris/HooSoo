import {
  roles,
  outranks,
  isSupervisorRole,
  isDepartmentRole,
} from "@hoosoo/shared";
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
    m?.active && m.orgId === ORG_ID && roles.includes(m.role),
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
    (isSupervisorRole(a.role) &&
      (isDepartmentRole(a.role) || e.managerId === a.employeeId) &&
      e.departmentId === s.employees[a.employeeId]?.departmentId)
  );
}
export function scopedEmployee(s: State, a: Actor, id: string) {
  const e = s.employees[id];
  if (!e || !inScope(s, a, e)) notFound();
  return e;
}
export function employeeView(e: Employee, a: Actor, s?: State): EmployeeView {
  const { phone, address, uid, ...work } = e;
  const canEdit = !!s && isHR(a) && canManageEmployee(s, a, e.id);
  const contact =
    a.employeeId === e.id || (isHR(a) && (a.role === "Admin" || canEdit));
  return {
    ...work,
    ...(contact ? { phone, address } : {}),
    ...(a.role === "Admin" ? { uid } : {}),
    ...(s ? { accessRole: employeeRole(s, e.id), canEdit } : {}),
  };
}
export function canApprove(s: State, a: Actor, employeeId: string) {
  return (
    a.employeeId !== employeeId &&
    canManageEmployee(s, a, employeeId) &&
    (isHR(a) ||
      (isSupervisorRole(a.role) &&
        !!s.employees[employeeId] &&
        inScope(s, a, s.employees[employeeId])))
  );
}

// A linked account's authority is read from memberships, never a job-title string.
// Missing linked membership fails closed instead of treating an Admin as Employee.
export function employeeRole(s: State, employeeId: string): Role | null {
  const e = s.employees[employeeId];
  if (!e) return null;
  const linked = e.uid
    ? s.memberships[e.uid]
    : Object.values(s.memberships).find((m) => m.employeeId === employeeId);
  return linked
    ? roles.includes(linked.role)
      ? linked.role
      : null
    : e.uid
      ? null
      : "Employee";
}
export function canManageEmployee(s: State, a: Actor, employeeId: string) {
  const role = employeeRole(s, employeeId);
  return (
    !!s.employees[employeeId] &&
    (a.role === "Admin" ||
      (role !== null &&
        outranks(a.role, role) &&
        inScope(s, a, s.employees[employeeId])))
  );
}
export function assertManageEmployee(s: State, a: Actor, employeeId: string) {
  assert(
    canManageEmployee(s, a, employeeId),
    403,
    "HIERARCHY_FORBIDDEN",
    "Bạn không được thay đổi hoặc xử lý hồ sơ cấp ngang hàng, cấp trên hay ngoài phạm vi phụ trách. Liên hệ quản trị viên.",
  );
}
