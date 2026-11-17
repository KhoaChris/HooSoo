import { createHash, randomUUID } from "node:crypto";
import type { State, Actor, WorkforceRecord } from "@hoosoo/shared";
import {
  canManageEmployee,
  isHR,
  employeeRole,
} from "../../common/authorization";
import {
  canReadCompensation,
  canManageCompensation,
} from "../compensation/compensation.service";
import { assert } from "../../utils/errors";
import { event, assertVersion } from "../workflows/approval";
import { audit } from "../../common/audit";
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
export const digest = (value: unknown) =>
  createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
export function record(
  s: State,
  a: Actor,
  reason: string,
  id: string = randomUUID(),
): WorkforceRecord {
  return {
    id,
    version: 1,
    createdAt: new Date().toISOString(),
    createdBy: a.uid,
    history: [event(s, a, "created", reason)],
  };
}
export function change(
  s: State,
  a: Actor,
  r: WorkforceRecord,
  action: string,
  reason: string,
) {
  r.version++;
  r.updatedAt = new Date().toISOString();
  r.history.push(event(s, a, action, reason));
  audit(s, a, `workforce.${action}`, r.id, { version: r.version }, "");
}
export function expected(r: WorkforceRecord | undefined, version: number) {
  assertVersion({ version: r?.version ?? 0 }, version);
}
export const manages = (s: State, a: Actor, id: string) =>
  isHR(a) && id !== a.employeeId && canManageEmployee(s, a, id);
export const visible = (s: State, a: Actor, id: string) =>
  !!s.employees[id] && (id === a.employeeId || canManageEmployee(s, a, id));
export const payRead = (s: State, a: Actor, id: string) =>
  canReadCompensation(s, a, id) ||
  (a.role === "Admin" && employeeRole(s, id) === "Admin");
export const payManage = (s: State, a: Actor, id: string) =>
  canManageCompensation(s, a, id) ||
  (a.role === "Admin" &&
    id !== a.employeeId &&
    employeeRole(s, id) === "Admin");
export function allowed(value: unknown) {
  assert(
    value,
    403,
    "WORKFORCE_FORBIDDEN",
    "Bạn không có quyền thực hiện thao tác này trong phạm vi hiện tại.",
  );
}
export function stateIs(value: unknown) {
  assert(
    value,
    409,
    "WORKFORCE_STATE",
    "Trạng thái đã thay đổi hoặc chưa đủ điều kiện. Vui lòng mở lại hồ sơ.",
  );
}
export function payrollUnlocked(s: State, employeeId: string, date: string) {
  assert(
    !Object.values(s.payrollStatements).some(
      (r) =>
        r.employeeId === employeeId &&
        r.period === date.slice(0, 7) &&
        ["approved", "published"].includes(r.status),
    ),
    409,
    "PAYROLL_LOCKED",
    "Kỳ lương đã khóa. Cần hủy phiếu lương để điều chỉnh dữ liệu nguồn.",
  );
}
