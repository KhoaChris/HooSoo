import { createHash } from "node:crypto";
import type { State, Role } from "@hoosoo/shared";
import { persistBalance } from "../../src/modules/leave/balances.service";
import { audit } from "../../src/common/audit";
import { businessDate } from "../../src/utils/time";

export const demoUsers: Array<{
  employeeId: string;
  email: string;
  name: string;
  role: Role;
  departmentId: string;
  positionId: string;
  managerId: string;
}> = [
  {
    employeeId: "demo-admin",
    email: "admin@hoosoo.example",
    name: "Quản trị viên Demo",
    role: "Admin",
    departmentId: "demo-ops",
    positionId: "demo-lead",
    managerId: "",
  },
  {
    employeeId: "demo-hr",
    email: "hr@hoosoo.example",
    name: "Nhân sự Demo",
    role: "HR",
    departmentId: "demo-ops",
    positionId: "demo-specialist",
    managerId: "demo-admin",
  },
  {
    employeeId: "demo-manager",
    email: "manager@hoosoo.example",
    name: "Quản lý Demo",
    role: "Manager",
    departmentId: "demo-tech",
    positionId: "demo-lead",
    managerId: "",
  },
  {
    employeeId: "demo-employee",
    email: "employee@hoosoo.example",
    name: "Nhân viên Demo",
    role: "Employee",
    departmentId: "demo-tech",
    positionId: "demo-developer",
    managerId: "demo-manager",
  },
];

export const demoBootstrapId = "cloud_demo_bootstrap_v1";

/** Initializes only an empty organization; reruns preserve all existing records. */
export function bootstrapDemoState(
  s: State,
  adminUid: string,
  orgId: string,
  now = new Date(),
) {
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ version: 1, adminUid, orgId }))
    .digest("hex");
  const previous = s.receipts[demoBootstrapId];
  if (previous) {
    if (previous.fingerprint !== fingerprint)
      throw new Error(
        "The demo was initialized with a different Admin identity",
      );
    return false;
  }
  if (Object.values(s).some((rows) => Object.keys(rows).length > 0)) {
    throw new Error(
      "Refusing to seed a non-empty organization without this demo's bootstrap marker",
    );
  }
  const today = businessDate(now);
  const year = Number(today.slice(0, 4));
  s.settings.main = {
    id: "main",
    companyName: "HooSoo Demo",
    annualAllowance: 12,
    schedule: {
      start: "08:00",
      end: "17:00",
      breakStart: "12:00",
      breakEnd: "13:00",
      lateGraceMinutes: 10,
      workDays: [1, 2, 3, 4, 5],
      holidays: [`${year}-01-01`, `${year}-09-02`],
    },
  };
  for (const [id, name] of [
    ["demo-ops", "Vận hành"],
    ["demo-tech", "Công nghệ"],
  ]) {
    s.departments[id] = {
      id,
      name,
      description: "Phòng ban giả lập để kiểm thử HooSoo",
      active: true,
    };
  }
  for (const [id, name] of [
    ["demo-lead", "Trưởng bộ phận"],
    ["demo-specialist", "Chuyên viên nhân sự"],
    ["demo-developer", "Lập trình viên"],
  ]) {
    s.positions[id] = { id, name, description: "Chức danh demo", active: true };
  }
  demoUsers.forEach((user, index) => {
    s.employees[user.employeeId] = {
      id: user.employeeId,
      employeeCode: `DEMO-00${index + 1}`,
      name: user.name,
      email: user.email,
      phone: "",
      address: "",
      departmentId: user.departmentId,
      positionId: user.positionId,
      managerId: user.managerId,
      hireDate: today,
      status: "active",
      ...(user.role === "Admin" ? { uid: adminUid } : {}),
      createdBy: adminUid,
    };
    persistBalance(s, user.employeeId, year, adminUid);
  });
  s.memberships[adminUid] = {
    id: adminUid,
    employeeId: "demo-admin",
    email: demoUsers[0].email,
    role: "Admin",
    active: true,
    orgId,
  };
  s.leaveTypes.annual = {
    id: "annual",
    name: "Nghỉ phép năm",
    deductsBalance: true,
    active: true,
  };
  s.leaveTypes.unpaid = {
    id: "unpaid",
    name: "Nghỉ không hưởng lương",
    deductsBalance: false,
    active: true,
  };
  audit(
    s,
    { uid: adminUid, employeeId: "demo-admin", role: "Admin", orgId },
    "demo.initialized",
    orgId,
    { employees: demoUsers.length },
    "Khởi tạo dữ liệu giả lập theo yêu cầu chủ project",
  );
  s.receipts[demoBootstrapId] = {
    id: demoBootstrapId,
    actorId: adminUid,
    fingerprint,
    result: { initializedAt: now.toISOString() },
  };
  return true;
}
