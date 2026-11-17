import {
  emptyEmployeeBackground,
  type Actor,
  type EmployeeBackgroundChange,
  type State,
} from "@hoosoo/shared";
import {
  scopedEmployee,
  requireRole,
  assertManageEmployee,
  employeeView,
} from "../../common/authorization";
import { assert } from "../../utils/errors";
import { audit } from "../../common/audit";

export function updateEmployeeBackground(
  s: State,
  a: Actor,
  id: string,
  input: EmployeeBackgroundChange,
) {
  const employee = scopedEmployee(s, a, id);
  if (id !== a.employeeId) {
    requireRole(a, ["Admin", "HR"]);
    assertManageEmployee(s, a, id);
  }
  const current = employee.background ?? emptyEmployeeBackground();
  assert(
    input.version === current.version,
    409,
    "VERSION_CONFLICT",
    "Hồ sơ đã thay đổi. Tải lại trước khi lưu.",
  );
  employee.background = {
    ...current,
    [input.section]: input.items,
    version: current.version + 1,
  };
  audit(s, a, "employee.background_updated", id, {
    section: input.section,
    count: input.items.length,
  });
  return employeeView(employee, a, s);
}
