import { describe, expect, it } from "vitest";
import type { Audit } from "@hoosoo/shared";
import {
  auditActor,
  auditChanges,
  auditSubject,
  auditTitle,
  type AuditLookups,
} from "../src/pages/settings/audit-presentation";
const lookups: AuditLookups = {
  employees: { e1: "Nguyễn Minh Anh" },
  accounts: { u1: "Nguyễn Minh Anh" },
  departments: { d1: "Vận hành", d2: "Công nghệ" },
  positions: {},
};
const entry = (action: string, changes: Record<string, unknown>): Audit => ({
  id: "a1",
  actorId: "u1",
  targetId: "e1",
  action,
  changes,
  reason: "",
  createdAt: "2026-11-12T09:00:00Z",
});
describe("Business-readable audit history", () => {
  it("shows recorded leave results without inventing a previous status or refund", () => {
    const result = auditChanges(
      entry("leave.cancel", { status: "cancelled", days: 1 }),
      lookups,
    );
    expect(result.comparison).toBe(false);
    expect(result.rows).toEqual([
      { key: "status", label: "Trạng thái", after: "Đã hủy" },
      { key: "days", label: "Số ngày nghỉ", after: "1 ngày" },
    ]);
    expect(JSON.stringify(result)).not.toContain("hoàn");
  });
  it("translates scalar role snapshots", () => {
    const result = auditChanges(
      entry("account.role", { before: "Employee", after: "Manager" }),
      lookups,
    );
    expect(result.comparison).toBe(true);
    expect(result.rows[0]).toMatchObject({
      before: "Nhân viên",
      after: "Trưởng phòng",
    });
  });
  it("shows only changed work fields and resolves references without raw identifiers", () => {
    const result = auditChanges(
      entry("employee.updated", {
        before: {
          name: "Nguyễn Minh Anh",
          departmentId: "d1",
          managerId: "old-uid",
        },
        after: {
          name: "Nguyễn Minh Anh",
          departmentId: "d2",
          managerId: "e1",
          privateKey: "secret",
          updatedAt: "new",
        },
      }),
      lookups,
    );
    expect(result.rows.map((r) => r.key)).toEqual([
      "departmentId",
      "managerId",
    ]);
    expect(result.rows[0]).toMatchObject({
      before: "Vận hành",
      after: "Công nghệ",
    });
    expect(result.rows[1]).toMatchObject({
      before: "Người quản lý trước đây",
      after: "Nguyễn Minh Anh",
    });
    expect(JSON.stringify(result)).not.toMatch(/secret|old-uid|updatedAt/);
  });
  it("keeps creation snapshots one-sided and does not turn unknown data into code", () => {
    const result = auditChanges(
      entry("employee.created", {
        before: null,
        after: { name: "Nguyễn Minh Anh", employeeCode: "HS-001" },
      }),
      lookups,
    );
    expect(result.comparison).toBe(false);
    expect(result.rows.every((r) => r.before === undefined)).toBe(true);
    const unknown = entry("internal.unrecognized", {
      internal: { token: "not-for-ui" },
    });
    expect(auditTitle(unknown)).toBe("Ghi nhận hoạt động");
    expect(auditChanges(unknown, lookups).rows).toEqual([]);
  });
  it("compares nested policy fields and formats the selected work week", () => {
    const result = auditChanges(
      entry("settings.updated", {
        before: {
          companyName: "HooSoo",
          schedule: {
            workDays: [1, 2, 3, 4, 5],
            lateGraceMinutes: 0,
            holidays: [],
          },
        },
        after: {
          companyName: "HooSoo",
          schedule: {
            workDays: [1, 2, 3, 4, 5, 6],
            lateGraceMinutes: 10,
            holidays: ["2026-09-02"],
          },
        },
      }),
      lookups,
    );
    expect(result.rows.map((r) => r.key)).toEqual([
      "schedule.lateGraceMinutes",
      "schedule.workDays",
      "schedule.holidays",
    ]);
    expect(result.rows[0]).toMatchObject({
      before: "0 phút",
      after: "10 phút",
    });
    expect(result.rows[1].after).toContain("Thứ 7");
  });
  it("does not invent contact values which were never saved in the audit", () => {
    const result = auditChanges(
      entry("profile.updated", {
        fields: ["phone", "address", "internalSecret"],
      }),
      lookups,
    );
    expect(result.rows.map((r) => r.label)).toEqual([
      "Số điện thoại",
      "Địa chỉ",
    ]);
    expect(result.rows.every((r) => r.after === "Đã cập nhật")).toBe(true);
  });
  it("distinguishes unknown actors and uses historical target names when recorded", () => {
    expect(auditActor("deleted-user", lookups)).toBe("Tài khoản chưa xác định");
    expect(auditActor("seed", lookups)).toBe("Hệ thống");
    expect(
      auditSubject(
        entry("employee.updated", { after: { name: "Tên đã lưu" } }),
        lookups,
      ),
    ).toBe("Tên đã lưu");
  });
});
