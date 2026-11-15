import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  salaryPackageSchema,
  recruitmentRewardSchema,
  compensationSetupSchema,
  compensationPhase,
  monthlyPackageTotal,
  type CompensationSetup,
} from "@hoosoo/shared";
import { fixture, actor } from "./fixture";
import {
  saveCompensation,
  compensationAction,
  compensationPerson,
  canManageCompensation,
  canReadCompensation,
  authorizeCompensationReplay,
} from "../src/modules/compensation/compensation.service";
const salary = () =>
  salaryPackageSchema.parse({
    currency: "VND",
    basis: "gross_monthly",
    baseSalary: 25_000_000,
    probationSalary: 21_000_000,
    allowances: [
      { id: "meal", kind: "meal", name: "Ăn trưa", amount: 700_000 },
    ],
    benefits: [
      {
        id: "health",
        kind: "health",
        name: "Bảo hiểm sức khỏe",
        detail: "Gói chăm sóc theo chính sách công ty",
      },
    ],
    bonusPolicy: "Xét thưởng theo kết quả đánh giá",
  });
const setup = (patch: Partial<CompensationSetup> = {}) =>
  compensationSetupSchema.parse({
    employeeId: "employee",
    effectiveDate: "2026-11-15",
    package: salary(),
    reason: "Điều chỉnh định kỳ",
    version: 0,
    ...patch,
  });
const publish = (s: ReturnType<typeof fixture>, id: string) =>
  compensationAction(s, actor("HR"), id, "publish", {
    version: s.compensationRecords[id].version,
    reason: "Đã kiểm tra chính sách",
  });
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-15T06:00:00Z"));
});
afterEach(() => vi.useRealTimers());
describe("compensation policy and effective records", () => {
  it("validates monetary values and explicit negotiable versus ranged salaries", () => {
    expect(monthlyPackageTotal(salary())).toBe(25_700_000);
    expect(monthlyPackageTotal(salary(), true)).toBe(21_700_000);
    for (const baseSalary of [0, -1, 1.2, NaN, Infinity, 10_000_000_001])
      expect(
        salaryPackageSchema.safeParse({ ...salary(), baseSalary }).success,
      ).toBe(false);
    for (const probationSalary of [0, -1, 26_000_000])
      expect(
        salaryPackageSchema.safeParse({ ...salary(), probationSalary }).success,
      ).toBe(false);
    expect(
      salaryPackageSchema.safeParse({ ...salary(), probationSalary: null })
        .success,
    ).toBe(true);
    expect(
      recruitmentRewardSchema.safeParse({
        mode: "range",
        currency: "VND",
        min: 30,
        max: 20,
        benefits: [],
      }).success,
    ).toBe(false);
    expect(
      recruitmentRewardSchema.safeParse({
        mode: "negotiable",
        currency: "VND",
        min: null,
        max: null,
        benefits: [],
      }).success,
    ).toBe(true);
    expect(
      recruitmentRewardSchema.safeParse({
        mode: "negotiable",
        currency: "VND",
        min: 20,
        max: 30,
        benefits: [],
      }).success,
    ).toBe(false);
    expect(
      salaryPackageSchema.safeParse({
        ...salary(),
        allowances: [...salary().allowances, ...salary().allowances],
      }).success,
    ).toBe(false);
  });
  it("lets HR manage lower ranks but denies self, peers and superiors", () => {
    const s = fixture();
    for (const employeeId of ["hr", "manager", "admin"])
      expect(() =>
        saveCompensation(s, actor("HR"), setup({ employeeId })),
      ).toThrow();
    expect(() =>
      saveCompensation(s, actor("Admin"), setup({ employeeId: "admin" })),
    ).toThrow();
    expect(saveCompensation(s, actor("HR"), setup()).status).toBe("draft");
  });
  it("gives only department managers read access to published subordinate pay", () => {
    const s = fixture(),
      r = saveCompensation(s, actor("HR"), setup());
    expect(
      compensationPerson(s, actor("Manager"), "employee").records,
    ).toHaveLength(0);
    publish(s, r.id);
    expect(
      compensationPerson(s, actor("Manager"), "employee").records[0].canEdit,
    ).toBe(false);
    expect(canManageCompensation(s, actor("Manager"), "employee")).toBe(false);
    for (const employeeId of ["outsider", "hr", "admin"])
      expect(canReadCompensation(s, actor("Manager"), employeeId)).toBe(false);
    expect(
      canReadCompensation(s, actor("TeamLead", "manager"), "employee"),
    ).toBe(false);
    expect(() =>
      compensationPerson(s, actor("Employee"), "outsider"),
    ).toThrow();
  });
  it("allows directors to manage lower ranks only in their department", () => {
    const s = fixture();
    s.employees.director = {
      ...s.employees.hr,
      id: "director",
      uid: "test-director",
    };
    s.memberships["test-director"] = {
      ...s.memberships["test-hr"],
      id: "test-director",
      employeeId: "director",
      role: "Director",
    };
    expect(canManageCompensation(s, actor("Director"), "manager")).toBe(true);
    expect(canManageCompensation(s, actor("Director"), "hr")).toBe(true);
    expect(canManageCompensation(s, actor("Director"), "outsider")).toBe(false);
    expect(canManageCompensation(s, actor("Director"), "admin")).toBe(false);
  });
  it("keeps published history immutable and switches effective plans by date", () => {
    const s = fixture(),
      first = saveCompensation(
        s,
        actor("HR"),
        setup({ effectiveDate: "2026-10-01" }),
      );
    publish(s, first.id);
    const later = saveCompensation(
      s,
      actor("HR"),
      setup({
        effectiveDate: "2026-12-01",
        package: { ...salary(), baseSalary: 30_000_000 },
      }),
    );
    publish(s, later.id);
    expect(
      compensationPerson(s, actor("Employee"), "employee").records.map(
        (r) => r.phase,
      ),
    ).toEqual(["scheduled", "current"]);
    const all = Object.values(s.compensationRecords);
    expect(compensationPhase(first, all, "2026-12-01")).toBe("superseded");
    expect(compensationPhase(later, all, "2026-12-01")).toBe("current");
    expect(() =>
      saveCompensation(
        s,
        actor("HR"),
        setup({ version: first.version }),
        first.id,
      ),
    ).toThrow();
    expect(() =>
      compensationAction(s, actor("HR"), first.id, "cancel", {
        version: first.version,
        reason: "Cancel history",
      }),
    ).toThrow();
    expect(first.package.baseSalary).toBe(25_000_000);
  });
  it("rejects conflicting effective dates, stale edits and backdated adjustments", () => {
    const s = fixture(),
      first = saveCompensation(s, actor("HR"), setup());
    publish(s, first.id);
    const duplicate = saveCompensation(s, actor("HR"), setup());
    expect(() => publish(s, duplicate.id)).toThrow();
    expect(() =>
      saveCompensation(s, actor("HR"), setup({ version: 0 }), duplicate.id),
    ).toThrow();
    expect(() =>
      saveCompensation(s, actor("HR"), setup({ effectiveDate: "2026-11-14" })),
    ).toThrow();
    expect(() =>
      saveCompensation(
        fixture(),
        actor("HR"),
        setup({ effectiveDate: "2025-12-31" }),
      ),
    ).toThrow();
    expect(
      compensationSetupSchema.safeParse({
        ...setup(),
        effectiveDate: "2026-02-31",
      }).success,
    ).toBe(false);
  });
  it("cancels future adjustments without changing current pay or exposing cancelled drafts", () => {
    const s = fixture(),
      first = saveCompensation(s, actor("HR"), setup());
    publish(s, first.id);
    const future = saveCompensation(
      s,
      actor("HR"),
      setup({ effectiveDate: "2026-12-01" }),
    );
    publish(s, future.id);
    compensationAction(s, actor("HR"), future.id, "cancel", {
      version: future.version,
      reason: "Kế hoạch đã thay đổi",
    });
    expect(
      compensationPerson(s, actor("Employee"), "employee").records.map(
        (r) => r.id,
      ),
    ).toEqual([first.id]);
    expect(
      compensationPerson(s, actor("HR"), "employee").records[0].phase,
    ).toBe("cancelled");
  });
  it("rechecks permission on replay after account or department changes", () => {
    const s = fixture(),
      r = saveCompensation(s, actor("HR"), setup());
    expect(() => authorizeCompensationReplay(s, actor("HR"), r)).not.toThrow();
    expect(() => authorizeCompensationReplay(s, actor("Manager"), r)).toThrow();
    s.memberships["test-employee"].role = "Director";
    expect(() => authorizeCompensationReplay(s, actor("HR"), r)).toThrow();
  });
  it("keeps amounts and private reasons out of generic audit records", () => {
    const s = fixture(),
      r = saveCompensation(
        s,
        actor("HR"),
        setup({ reason: "Private compensation reason" }),
      );
    publish(s, r.id);
    const audit = JSON.stringify(s.auditLogs);
    expect(audit).not.toContain("25000000");
    expect(audit).not.toContain("Private compensation reason");
    expect(r.history[0].reason).toBe("Private compensation reason");
  });
});
