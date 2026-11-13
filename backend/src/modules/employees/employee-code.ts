import type { State } from "@hoosoo/shared";
import { assert } from "../../utils/errors";

// Called only within the employee-creation transaction. Both entry points load
// this singleton and the directory required for manager/reference validation.
export function nextEmployeeCode(s: State): string {
  const sequence = s.employeeSequences.main;
  const saved = sequence ? sequence.lastNumber : 0;
  assert(
    Number.isSafeInteger(saved) && saved >= 0 && saved <= 999999,
    503,
    "EMPLOYEE_SEQUENCE_INVALID",
    "Chưa thể cấp mã nhân viên. Vui lòng liên hệ quản trị viên.",
  );
  // Bootstrap safely from existing codes, without renumbering legacy records.
  const existing = Object.values(s.employees).reduce((highest, employee) => {
    const match = /^HS-(\d{6})$/i.exec(employee.employeeCode);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  const next = Math.max(saved, existing) + 1;
  assert(
    next <= 999999,
    409,
    "EMPLOYEE_SEQUENCE_EXHAUSTED",
    "Dải mã nhân viên đã đầy. Vui lòng liên hệ quản trị viên.",
  );
  s.employeeSequences.main = { ...sequence, id: "main", lastNumber: next };
  return `HS-${String(next).padStart(6, "0")}`;
}
