import { auth } from "../src/config/firebase-admin";
import { env, ORG_ID } from "../src/config/env";
import { mutate, readiness } from "../src/database/store";
import { businessDate, workDates } from "../src/utils/time";
import {
  createLeave,
  transitionLeave,
} from "../src/modules/leave/leave.service";
import { persistBalance } from "../src/modules/leave/balances.service";
import type { Actor, Role } from "@hoosoo/shared";

if (
  env.NODE_ENV === "production" ||
  env.FIREBASE_MODE !== "emulator" ||
  env.FIREBASE_PROJECT_ID !== "demo-hoosoo"
)
  throw new Error("Seed is restricted to local demo-hoosoo emulators");
await readiness();
const accounts = [
  {
    uid: "hs-admin",
    employeeId: "staff01",
    email: "admin@hoosoo.demo",
    role: "Admin",
  },
  {
    uid: "hs-hr",
    employeeId: "staff06",
    email: "nhansu@hoosoo.demo",
    role: "HR",
  },
  {
    uid: "hs-manager",
    employeeId: "staff11",
    email: "quanly@hoosoo.demo",
    role: "Manager",
  },
  {
    uid: "hs-employee",
    employeeId: "staff12",
    email: "nhanvien@hoosoo.demo",
    role: "Employee",
  },
  {
    uid: "hs-manager2",
    employeeId: "staff16",
    email: "quanly2@hoosoo.demo",
    role: "Manager",
  },
];
const password = env.DEMO_PASSWORD || "HooSooDemo!2026";
for (const a of accounts) {
  try {
    await auth.getUser(a.uid);
  } catch (e) {
    if ((e as { code?: string }).code !== "auth/user-not-found") throw e;
    await auth.createUser({
      uid: a.uid,
      email: a.email,
      password,
      displayName: "HooSoo Demo " + a.role,
    });
  }
}
const names = [
  "Trần Minh Khôi",
  "Nguyễn Hà Linh",
  "Lê Hoàng Phúc",
  "Phạm Ngọc Hân",
  "Võ Tuấn Kiệt",
  "Nguyễn An Nhiên",
  "Trần Thanh Trúc",
  "Lê Bảo Anh",
  "Đặng Minh Châu",
  "Phan Quốc Bảo",
  "Nguyễn Duy Khang",
  "Bùi Đức Đăng Khoa",
  "Trần Gia Huy",
  "Đỗ Khánh Vy",
  "Phạm Nhật Minh",
  "Vũ Minh Anh",
  "Lâm Hải Đăng",
  "Nguyễn Bảo Ngọc",
  "Lê Khánh Linh",
  "Trịnh Quang Huy",
  "Phạm Đức Duy",
  "Ngô Diệu Linh",
  "Hoàng Anh Thư",
  "Võ Gia Bảo",
  "Lê Tường Vy",
];
const now = new Date(),
  today = businessDate(now),
  year = Number(today.slice(0, 4));
const result = await mutate((s) => {
  if (s.settings.main)
    return "Existing data preserved; seed is already initialized.";
  s.settings.main = {
    id: "main",
    companyName: "HooSoo Demo Company",
    annualAllowance: 12,
    schedule: {
      start: "08:00",
      end: "18:00",
      breakStart: "12:00",
      breakEnd: "13:00",
      lateGraceMinutes: 10,
      workDays: [1, 2, 3, 4, 5],
      holidays: [`${year}-01-01`, `${year}-09-02`],
    },
  };
  ["Vận hành", "Nhân sự", "Công nghệ", "Kinh doanh", "Tài chính"].forEach(
    (name, i) =>
      (s.departments["dept" + (i + 1)] = {
        id: "dept" + (i + 1),
        name,
        description:
          "Phòng " + name.toLowerCase() + " của doanh nghiệp giả lập",
        active: true,
      }),
  );
  [
    "Trưởng bộ phận",
    "Chuyên viên",
    "Front-end Developer",
    "Chuyên viên kiểm thử",
    "Thực tập sinh",
  ].forEach(
    (name, i) =>
      (s.positions["pos" + (i + 1)] = {
        id: "pos" + (i + 1),
        name,
        description: "Chức danh demo",
        active: true,
      }),
  );
  names.forEach((name, i) => {
    const id = "staff" + String(i + 1).padStart(2, "0"),
      account = accounts.find((a) => a.employeeId === id),
      head = Math.floor(i / 5) * 5 + 1;
    s.employees[id] = {
      id,
      employeeCode: "HS" + String(i + 1).padStart(3, "0"),
      name,
      email: account?.email || `demo${i + 1}@hoosoo.demo`,
      phone: "090000" + String(i + 1).padStart(4, "0"),
      address: "Địa chỉ minh họa, TP. Hồ Chí Minh",
      departmentId: "dept" + (Math.floor(i / 5) + 1),
      positionId:
        i % 5 === 0
          ? "pos1"
          : i === 11
            ? "pos3"
            : i % 5 === 4
              ? "pos5"
              : "pos2",
      managerId: i % 5 === 0 ? "" : "staff" + String(head).padStart(2, "0"),
      hireDate: i % 5 === 4 ? today.slice(0, 8) + "01" : `${year}-01-05`,
      status: i % 5 === 4 ? "probation" : "active",
      ...(account ? { uid: account.uid } : {}),
    };
  });
  for (const account of accounts)
    s.memberships[account.uid] = {
      id: account.uid,
      employeeId: account.employeeId,
      email: account.email,
      role: account.role as Role,
      active: true,
      orgId: ORG_ID,
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
  s.leaveTypes.other = {
    id: "other",
    name: "Nghỉ đặc biệt (demo)",
    deductsBalance: false,
    active: true,
  };
  for (const e of Object.values(s.employees))
    persistBalance(s, e.id, year, "seed");
  const past = workDates(
    businessDate(new Date(now.getTime() - 16 * 86400000)),
    businessDate(new Date(now.getTime() - 86400000)),
    s.settings.main.schedule,
  ).slice(-10);
  for (const [i, e] of Object.values(s.employees).entries())
    for (const [j, date] of past.entries()) {
      const id = e.id + "_" + date;
      s.attendanceRecords[id] = {
        id,
        employeeId: e.id,
        date,
        checkIn: new Date(
          `${date}T${(i + j) % 6 === 0 ? "08:25" : "07:55"}:00+07:00`,
        ).toISOString(),
        checkOut:
          (i + j) % 13 === 0
            ? null
            : new Date(`${date}T18:00:00+07:00`).toISOString(),
        schedule: structuredClone(s.settings.main.schedule),
        adjustments: [],
      };
    }
  const admin: Actor = {
    uid: "hs-admin",
    employeeId: "staff01",
    role: "Admin",
    orgId: ORG_ID,
  };
  const employee = (id: string): Actor => ({
    uid:
      Object.values(s.memberships).find((m) => m.employeeId === id)?.id ||
      "seed",
    employeeId: id,
    role: "Employee",
    orgId: ORG_ID,
  });
  const future = workDates(
    businessDate(new Date(now.getTime() + 86400000)),
    businessDate(new Date(now.getTime() + 30 * 86400000)),
    s.settings.main.schedule,
  ).filter((d) => d.startsWith(String(year)));
  const dates = future.length >= 4 ? future : past;
  const approved = createLeave(s, employee("staff12"), {
    leaveTypeId: "annual",
    startDate: dates[1],
    endDate: dates[1],
    reason: "Việc gia đình (dữ liệu demo)",
  });
  transitionLeave(
    s,
    admin,
    approved.id,
    "approve",
    "Đã sắp xếp công việc trong nhóm",
  );
  createLeave(s, employee("staff13"), {
    leaveTypeId: "annual",
    startDate: dates[2],
    endDate: dates[2],
    reason: "Giải quyết việc cá nhân (demo)",
  });
  const rejected = createLeave(s, employee("staff17"), {
    leaveTypeId: "annual",
    startDate: dates[0],
    endDate: dates[0],
    reason: "Kế hoạch nghỉ cá nhân (demo)",
  });
  transitionLeave(
    s,
    admin,
    rejected.id,
    "reject",
    "Cần trao đổi lại kế hoạch bàn giao",
  );
  const cancelled = createLeave(s, employee("staff18"), {
    leaveTypeId: "unpaid",
    startDate: dates[3],
    endDate: dates[3],
    reason: "Lịch cá nhân thay đổi (demo)",
  });
  transitionLeave(
    s,
    employee("staff18"),
    cancelled.id,
    "cancel",
    "Không còn nhu cầu nghỉ",
  );
  s.auditLogs["seed-initialized"] = {
    id: "seed-initialized",
    actorId: "seed",
    action: "demo.initialized",
    targetId: ORG_ID,
    reason: "Synthetic demonstration data only",
    changes: { employees: 25, departments: 5 },
  };
  return "Seeded 25 employees, 5 departments, 5 demo accounts and business history.";
});
console.log(result);
console.log(
  "Demo accounts: " +
    accounts.map((a) => a.email + " (" + a.role + ")").join(", "),
);
console.log(
  env.DEMO_PASSWORD
    ? "Using the configured DEMO_PASSWORD."
    : "Local-only default password: HooSooDemo!2026",
);
process.exit(0);
