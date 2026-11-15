import { afterEach, describe, expect, it } from "vitest";
import { type PerformanceGoal, type PerformanceView } from "@hoosoo/shared";
import {
  convertLegacyGoals,
  performancePlanningSchema,
  quarterDeadline,
  reviewTitle,
  scheduleDefaults,
} from "../src/pages/performance/performance-planning";
import { setPreferences } from "../src/i18n/preferences";
afterEach(() => setPreferences({ locale: "vi" }));
const goals: PerformanceGoal[] = [
  {
    id: "goal",
    kind: "qualitative",
    title: "Chất lượng công việc",
    expectation: "Đáp ứng yêu cầu nghiệm thu của dự án",
    priority: "standard",
    weight: 100,
  },
];
describe("review planning", () => {
  it("derives the canonical title and date range from selections", () => {
    const parsed = performancePlanningSchema.parse({
      employeeId: "employee",
      schedule: { quarter: 4, year: 2026, managerDue: "2027-01-14" },
      goals,
      version: 0,
    });
    expect(parsed).toMatchObject({
      period: { quarter: 4, year: 2026 },
      title: "Quý IV / 2026",
      startDate: "2026-10-01",
      endDate: "2026-12-31",
      managerDue: "2027-01-14",
    });
    expect(parsed).not.toHaveProperty("schedule");
    expect(
      performancePlanningSchema.safeParse({
        employeeId: "employee",
        schedule: { quarter: 4, year: 2026, managerDue: "2026-11-15" },
        goals,
        version: 0,
      }).success,
    ).toBe(false);
  });
  it("uses quarter-end dates and rolls the default deadline into the next year", () => {
    expect(scheduleDefaults("2026-11-15")).toEqual({
      quarter: 4,
      year: 2026,
      managerDue: "2027-01-14",
    });
    expect(quarterDeadline("2028-03-31")).toBe("2028-04-14");
    expect(
      scheduleDefaults("2026-11-15", {
        startDate: "2026-11-15",
        endDate: "2026-11-30",
        managerDue: "2026-12-10",
      } as PerformanceView).quarter,
    ).toBe(0);
  });
  it("requires an explicit conversion for legacy numeric targets and preserves their context", () => {
    const legacy: PerformanceGoal[] = [
      {
        id: "errors",
        title: "Lỗi sau nghiệm thu",
        unit: "lỗi",
        target: 2,
        direction: "lower",
        weight: 100,
      },
    ];
    expect(convertLegacyGoals(legacy)).toEqual([
      {
        id: "errors",
        title: "Lỗi sau nghiệm thu",
        kind: "qualitative",
        expectation: "≤ 2 lỗi",
        priority: "standard",
        weight: 100,
      },
    ]);
    expect(legacy[0]).not.toHaveProperty("kind");
  });
  it("localizes selected periods without rewriting stored titles", () => {
    const item = { title: "Quý IV / 2026", period: { quarter: 4, year: 2026 } };
    setPreferences({ locale: "vi" });
    expect(reviewTitle(item)).toBe("Quý IV / 2026");
    setPreferences({ locale: "en" });
    expect(reviewTitle(item)).toBe("Q4 / 2026");
    expect(reviewTitle({ title: "Custom historical period" })).toBe(
      "Custom historical period",
    );
  });
});
