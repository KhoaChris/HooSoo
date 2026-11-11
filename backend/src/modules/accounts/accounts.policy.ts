import type { State } from "@hoosoo/shared";
import { assert } from "../../utils/errors";

export function protectAdmin(s: State, uid: string) {
  const others = Object.values(s.memberships).filter(
    (m) =>
      m.id !== uid &&
      m.active &&
      m.role === "Admin" &&
      s.employees[m.employeeId]?.status !== "terminated",
  );
  assert(
    others.length > 0,
    409,
    "LAST_ADMIN",
    "Không thể vô hiệu hóa hoặc hạ quyền quản trị viên cuối cùng.",
  );
}
