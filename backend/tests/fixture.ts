import type { State, Actor, Role, Employee } from "@hoosoo/shared";
import { emptyState } from "../src/database/store";
import { ORG_ID } from "../src/config/env";

export function fixture() {
  const s = emptyState();
  s.settings.main = {
    id: "main",
    companyName: "Test Company",
    annualAllowance: 12,
    schedule: {
      start: "08:00",
      end: "18:00",
      breakStart: "12:00",
      breakEnd: "13:00",
      lateGraceMinutes: 10,
      workDays: [1, 2, 3, 4, 5],
      holidays: ["2026-09-02"],
    },
  };
  for (const id of ["a", "b"])
    s.departments[id] = {
      id,
      name: "Dept " + id,
      description: "",
      active: true,
    };
  s.positions.dev = {
    id: "dev",
    name: "Developer",
    description: "",
    active: true,
  };
  s.leaveTypes.annual = {
    id: "annual",
    name: "Annual",
    deductsBalance: true,
    active: true,
  };
  s.leaveTypes.unpaid = {
    id: "unpaid",
    name: "Unpaid",
    deductsBalance: false,
    active: true,
  };
  const entries: [string, Role, string, string][] = [
    ["admin", "Admin", "a", ""],
    ["hr", "HR", "a", ""],
    ["manager", "Manager", "a", ""],
    ["employee", "Employee", "a", "manager"],
    ["outsider", "Employee", "b", ""],
    ["manager2", "Manager", "b", ""],
  ];
  for (const [id, role, departmentId, managerId] of entries) {
    s.employees[id] = {
      id,
      employeeCode: id.toUpperCase(),
      name: id,
      email: `test-${id}@hoosoo.demo`,
      phone: "private phone",
      address: "private address",
      departmentId,
      managerId,
      positionId: "dev",
      hireDate: "2026-01-01",
      status: "active",
      uid: "test-" + id,
    };
    s.memberships["test-" + id] = {
      id: "test-" + id,
      employeeId: id,
      role,
      active: true,
      email: `test-${id}@hoosoo.demo`,
      orgId: ORG_ID,
    };
  }
  return s;
}
export const actor = (role: Role, id = role.toLowerCase()): Actor => ({
  uid: "test-" + id,
  employeeId: id,
  role,
  orgId: ORG_ID,
});
export function fields(e: Employee) {
  const {
    id: _id,
    uid: _uid,
    createdAt: _ca,
    updatedAt: _ua,
    createdBy: _cb,
    ...input
  } = e;
  return input;
}
export function replaceState(target: State, source: State) {
  Object.assign(target, structuredClone(source));
}
