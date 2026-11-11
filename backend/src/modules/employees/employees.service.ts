import { randomUUID } from "node:crypto";
import type {
  State,
  Actor,
  EmployeeInput,
  Employee,
  Role,
} from "@hoosoo/shared";
import { assert, notFound } from "../../utils/errors";
import { audit } from "../../common/audit";
import { requireRole } from "../../common/authorization";
import { protectAdmin } from "../accounts/accounts.policy";

const hr: Role[] = ["Admin", "HR"];
export function saveEmployee(
  s: State,
  a: Actor,
  input: EmployeeInput,
  id?: string,
) {
  requireRole(a, hr);
  const old = id ? s.employees[id] : undefined;
  if (id && !old) notFound();
  assert(
    !Object.values(s.employees).some(
      (e) =>
        e.id !== id &&
        e.employeeCode.toLowerCase() === input.employeeCode.toLowerCase(),
    ),
    409,
    "EMPLOYEE_CODE_EXISTS",
    "Mã nhân viên đã tồn tại.",
  );
  for (const [table, key] of [
    ["departments", "departmentId"],
    ["positions", "positionId"],
  ] as const)
    assert(
      s[table][input[key]]?.active,
      400,
      "INVALID_REFERENCE",
      "Phòng ban hoặc chức danh không còn hoạt động.",
    );
  if (old?.uid)
    assert(
      old.email === input.email,
      409,
      "ACCOUNT_EMAIL_LOCKED",
      "Email đã liên kết tài khoản. Không thể thay đổi từ hồ sơ.",
    );
  const employeeId = id || randomUUID();
  if (input.managerId) {
    const m = s.employees[input.managerId];
    assert(
      m && m.status !== "terminated" && m.departmentId === input.departmentId,
      400,
      "INVALID_MANAGER",
      "Người quản lý phải đang làm việc trong cùng phòng ban.",
    );
    let cursor: string | undefined = m.id;
    const visited = new Set<string>();
    while (cursor) {
      assert(
        cursor !== employeeId && !visited.has(cursor),
        409,
        "MANAGER_CYCLE",
        "Quan hệ quản lý tạo thành vòng lặp.",
      );
      visited.add(cursor);
      cursor = s.employees[cursor]?.managerId;
    }
  }
  if (
    old &&
    (old.departmentId !== input.departmentId || input.status === "terminated")
  )
    assert(
      !Object.values(s.employees).some(
        (e) => e.managerId === old.id && e.status !== "terminated",
      ),
      409,
      "MANAGER_HAS_REPORTS",
      "Hãy điều chuyển cấp dưới trước khi điều chuyển hoặc kết thúc người quản lý.",
    );
  if (input.status === "terminated" && old?.uid) {
    const member = s.memberships[old.uid];
    if (member?.active && member.role === "Admin") protectAdmin(s, member.id);
  }
  const result: Employee = {
    ...old,
    ...input,
    id: employeeId,
    createdAt: old?.createdAt || new Date().toISOString(),
    createdBy: old?.createdBy || a.uid,
  };
  s.employees[result.id] = result;
  if (input.status === "terminated" && old?.uid && s.memberships[old.uid])
    s.memberships[old.uid].active = false;
  audit(s, a, old ? "employee.updated" : "employee.created", result.id, {
    before: old ? workFields(old) : null,
    after: workFields(result),
  });
  return result;
}
function workFields(e: Employee) {
  return {
    name: e.name,
    employeeCode: e.employeeCode,
    departmentId: e.departmentId,
    positionId: e.positionId,
    managerId: e.managerId,
    hireDate: e.hireDate,
    status: e.status,
  };
}
