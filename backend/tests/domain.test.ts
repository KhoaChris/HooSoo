import { describe, it, expect } from "vitest";
import { fixture, actor, fields } from "./fixture";
import {
  businessDate,
  attendanceMetrics,
  workDates,
  csv,
} from "../src/utils/time";
import {
  checkIn,
  checkOut,
} from "../src/modules/attendance/attendance.service";
import {
  createLeave,
  transitionLeave,
} from "../src/modules/leave/leave.service";
import { adjustBalance } from "../src/modules/leave/balances.service";
import { saveEmployee } from "../src/modules/employees/employees.service";
import { catalogStatus } from "../src/modules/organization/organization.service";
import { protectAdmin } from "../src/modules/accounts/accounts.policy";
import { employeeView, inScope } from "../src/common/authorization";
import { parseEnv } from "../src/config/env";
import { parseFrontendEnv } from "../../frontend/src/config/env";
import { bootstrapDemoState, demoUsers } from "../scripts/lib/demo-bootstrap";
import { emptyState } from "../src/database/store";
import type { Attendance } from "@hoosoo/shared";

const input = {
  leaveTypeId: "annual",
  startDate: "2026-11-16",
  endDate: "2026-11-17",
  reason: "Personal leave test",
};
describe("Cloud demo bootstrap safeguards", () => {
  it("links the initial Admin and creates valid employee references and balances", () => {
    const s = emptyState();
    expect(
      bootstrapDemoState(
        s,
        "new-admin",
        "hoosoo-tests",
        new Date("2026-11-11T02:00:00Z"),
      ),
    ).toBe(true);
    expect(s.memberships["new-admin"]).toMatchObject({
      employeeId: "demo-admin",
      role: "Admin",
      active: true,
      orgId: "hoosoo-tests",
    });
    for (const user of demoUsers) {
      const employee = s.employees[user.employeeId];
      expect(s.departments[employee.departmentId].active).toBe(true);
      expect(s.positions[employee.positionId].active).toBe(true);
      if (employee.managerId)
        expect(s.employees[employee.managerId].departmentId).toBe(
          employee.departmentId,
        );
      expect(s.leaveBalances[employee.id + "_2026"]).toMatchObject({
        allowance: 12,
        used: 0,
      });
    }
  });
  it("preserves edits and avoids duplicating records on rerun", () => {
    const s = emptyState();
    bootstrapDemoState(s, "new-admin", "hoosoo-tests");
    s.settings.main.companyName = "Edited company";
    s.employees["demo-employee"].name = "Edited employee";
    const before = structuredClone(s);
    expect(bootstrapDemoState(s, "new-admin", "hoosoo-tests")).toBe(false);
    expect(s).toEqual(before);
    expect(() =>
      bootstrapDemoState(s, "another-admin", "hoosoo-tests"),
    ).toThrow("different Admin");
  });
  it("refuses to seed an existing unrelated organization", () => {
    const s = fixture();
    const before = structuredClone(s);
    expect(() => bootstrapDemoState(s, "new-admin", "hoosoo-tests")).toThrow(
      "non-empty organization",
    );
    expect(s).toEqual(before);
  });
});
describe("Cloud web configuration", () => {
  const cloud = {
    VITE_API_BASE_URL: "/api/v1",
    VITE_FIREBASE_MODE: "cloud",
    VITE_FIREBASE_API_KEY: "public-test-key",
    VITE_FIREBASE_AUTH_DOMAIN: "test-project.firebaseapp.com",
    VITE_FIREBASE_PROJECT_ID: "test-project",
    VITE_FIREBASE_APP_ID: "1:123:web:test",
  };
  it("accepts cloud configuration in production", () => {
    expect(parseFrontendEnv(cloud, true).VITE_FIREBASE_MODE).toBe("cloud");
  });
  it("rejects inherited emulator URLs in cloud mode", () => {
    expect(() =>
      parseFrontendEnv(
        { ...cloud, VITE_FIREBASE_AUTH_EMULATOR_URL: "http://127.0.0.1:9099" },
        true,
      ),
    ).toThrow("Cloud refuses emulator settings");
  });
  it("refuses emulator bundles in production", () => {
    expect(() =>
      parseFrontendEnv(
        {
          ...cloud,
          VITE_FIREBASE_MODE: "emulator",
          VITE_FIREBASE_PROJECT_ID: "demo-hoosoo",
          VITE_FIREBASE_AUTH_EMULATOR_URL: "http://127.0.0.1:9099",
        },
        true,
      ),
    ).toThrow("Production refuses emulator mode");
  });
  it("rejects protocol-relative API destinations", () => {
    expect(() =>
      parseFrontendEnv({ ...cloud, VITE_API_BASE_URL: "//example.com" }, true),
    ).toThrow("Protocol-relative");
  });
});
describe("Vietnam business calendar and attendance", () => {
  it("uses Vietnam date at UTC boundary", () =>
    expect(businessDate(new Date("2026-11-10T18:00:00Z"))).toBe("2026-11-11"));
  it("excludes weekends and configured holidays", () =>
    expect(
      workDates("2026-08-31", "2026-09-06", fixture().settings.main.schedule),
    ).toEqual(["2026-08-31", "2026-09-01", "2026-09-03", "2026-09-04"]));
  it("counts only break overlap and clips paid time to shift", () => {
    const s = fixture();
    const r: Attendance = {
      id: "x",
      employeeId: "employee",
      date: "2026-11-10",
      checkIn: "2026-11-10T11:45:00+07:00",
      checkOut: "2026-11-10T12:15:00+07:00",
      schedule: s.settings.main.schedule,
      adjustments: [],
    };
    expect(attendanceMetrics(r)).toMatchObject({
      presenceMinutes: 30,
      paidMinutes: 15,
    });
    r.checkIn = "2026-11-10T07:00:00+07:00";
    r.checkOut = "2026-11-10T19:00:00+07:00";
    expect(attendanceMetrics(r)).toMatchObject({
      presenceMinutes: 720,
      paidMinutes: 540,
    });
  });
  it("does not invent hours for missing checkout", () => {
    const s = fixture();
    const r = checkIn(
      s,
      actor("Employee"),
      new Date("2026-11-10T08:00:00+07:00"),
    );
    expect(
      attendanceMetrics(r, new Date("2026-11-11T00:00:00+07:00")),
    ).toMatchObject({
      paidMinutes: null,
      presenceMinutes: null,
      status: "missing_checkout",
    });
  });
  it("prevents duplicate check-in and checkout before check-in", () => {
    const s = fixture(),
      a = actor("Employee"),
      now = new Date("2026-11-10T08:00:00+07:00");
    expect(() => checkOut(s, a, now)).toThrow();
    checkIn(s, a, now);
    checkIn(s, a, now);
    expect(Object.keys(s.attendanceRecords)).toHaveLength(1);
  });
});
describe("Leave state machine and balance", () => {
  it("rejects reverse, cross-year, non-working and overlapping ranges", () => {
    const s = fixture(),
      a = actor("Employee");
    for (const range of [
      { startDate: "2026-11-17", endDate: "2026-11-16" },
      { startDate: "2026-12-31", endDate: "2027-01-01" },
      { startDate: "2026-11-14", endDate: "2026-11-15" },
    ])
      expect(() => createLeave(s, a, { ...input, ...range })).toThrow();
    createLeave(s, a, input);
    expect(() => createLeave(s, a, input)).toThrow();
  });
  it("forbids self approval even for Admin", () => {
    const s = fixture(),
      a = actor("Admin");
    const r = createLeave(s, a, input);
    expect(() => transitionLeave(s, a, r.id, "approve")).toThrow("tự duyệt");
  });
  it("debited and refunded exactly once; pending is not reserved", () => {
    const s = fixture(),
      e = actor("Employee"),
      admin = actor("Admin");
    const r = createLeave(s, e, input);
    expect(s.leaveBalances.employee_2026.used).toBe(0);
    transitionLeave(s, admin, r.id, "approve");
    transitionLeave(s, admin, r.id, "approve");
    expect(s.leaveBalances.employee_2026.used).toBe(2);
    expect(() => transitionLeave(s, e, r.id, "cancel")).toThrow();
    transitionLeave(s, admin, r.id, "cancel", "Approved cancellation");
    transitionLeave(s, admin, r.id, "cancel", "Approved cancellation");
    expect(s.leaveBalances.employee_2026.used).toBe(0);
    expect(
      Object.values(s.leaveBalanceTransactions).filter(
        (t) => t.kind === "refund",
      ),
    ).toHaveLength(1);
  });
  it("rechecks balance at approval, snapshots type policy", () => {
    const s = fixture(),
      r = createLeave(s, actor("Employee"), input);
    s.leaveTypes.annual.deductsBalance = false;
    adjustBalance(s, actor("HR"), "employee", {
      year: 2026,
      amount: -11,
      reason: "Quota correction",
    });
    expect(() => transitionLeave(s, actor("Admin"), r.id, "approve")).toThrow(
      "không đủ",
    );
    expect(r.deductsBalance).toBe(true);
  });
  it("prevents arbitrary transitions and requires rejection reason", () => {
    const s = fixture(),
      r = createLeave(s, actor("Employee"), input);
    expect(() =>
      transitionLeave(s, actor("Manager"), r.id, "reject", ""),
    ).toThrow();
    transitionLeave(s, actor("Manager"), r.id, "reject", "Handover needed");
    expect(() =>
      transitionLeave(s, actor("Manager"), r.id, "approve"),
    ).toThrow();
  });
});
describe("Organizational authorization and invariants", () => {
  it("redacts private contact fields for Manager", () => {
    const e = employeeView(fixture().employees.employee, actor("Manager"));
    expect(e).not.toHaveProperty("phone");
    expect(e).not.toHaveProperty("address");
    expect(e).not.toHaveProperty("uid");
  });
  it("updates manager scope immediately on transfer", () => {
    const s = fixture();
    expect(inScope(s, actor("Manager"), s.employees.employee)).toBe(true);
    saveEmployee(
      s,
      actor("HR"),
      {
        ...fields(s.employees.employee),
        departmentId: "b",
        managerId: "manager2",
      },
      "employee",
    );
    expect(inScope(s, actor("Manager"), s.employees.employee)).toBe(false);
    expect(inScope(s, actor("Manager", "manager2"), s.employees.employee)).toBe(
      true,
    );
  });
  it("rejects duplicate codes, cycles, dangling references and in-use department deactivation", () => {
    const s = fixture();
    expect(() =>
      saveEmployee(s, actor("HR"), fields(s.employees.employee)),
    ).toThrow();
    expect(() =>
      saveEmployee(
        s,
        actor("HR"),
        { ...fields(s.employees.manager), managerId: "employee" },
        "manager",
      ),
    ).toThrow();
    expect(() =>
      saveEmployee(
        s,
        actor("HR"),
        { ...fields(s.employees.employee), departmentId: "missing" },
        "employee",
      ),
    ).toThrow();
    expect(() =>
      catalogStatus(s, actor("HR"), "departments", "a", false),
    ).toThrow();
  });
  it("protects the last active Admin", () =>
    expect(() => protectAdmin(fixture(), "test-admin")).toThrow("cuối cùng"));
  it("neutralizes spreadsheet formula injection", () => {
    expect(csv([{ Name: ' =HYPERLINK("bad")' }])).toContain("' =HYPERLINK");
    expect(csv([{ Name: "Đăng Khoa" }]).startsWith("\ufeff")).toBe(true);
  });
  it("rejects cloud/emulator confusion and production emulator", () => {
    const base = {
      CORS_ORIGINS: "http://localhost:5173",
      FIREBASE_PROJECT_ID: "demo-hoosoo",
      FIREBASE_MODE: "emulator",
      FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
    };
    expect(() => parseEnv({ ...base, NODE_ENV: "production" })).toThrow();
    expect(() =>
      parseEnv({
        ...base,
        FIREBASE_MODE: "cloud",
        FIREBASE_PROJECT_ID: "real-project",
      }),
    ).toThrow();
  });
});

it("does not count off-schedule or holiday attendance as paid time", () => {
  const s = fixture();
  for (const date of ["2026-11-14", "2026-09-02"]) {
    const r: Attendance = {
      id: "off",
      employeeId: "employee",
      date,
      checkIn: date + "T08:00:00+07:00",
      checkOut: date + "T18:00:00+07:00",
      schedule: s.settings.main.schedule,
      adjustments: [],
    };
    expect(attendanceMetrics(r)).toMatchObject({
      presenceMinutes: 600,
      paidMinutes: 0,
      late: false,
    });
  }
});
