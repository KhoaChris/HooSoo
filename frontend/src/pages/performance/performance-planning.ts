import { z } from "zod";
import {
  balancePerformanceGoals,
  performanceGoalSchema,
  performanceQuarter,
  performanceSetupSchema,
  type PerformanceView,
  type PerformanceGoal,
} from "@hoosoo/shared";
import { t, intlLocale } from "../../i18n";

export function reviewTitle(item: Pick<PerformanceView, "period" | "title">) {
  return item.period
    ? t("Quý {0} / {1}", [
        intlLocale().startsWith("vi")
          ? ["I", "II", "III", "IV"][item.period.quarter - 1]
          : item.period.quarter,
        item.period.year,
      ])
    : item.title;
}
export function quarterLabel(quarter: number) {
  return t("Quý {0}", [
    intlLocale().startsWith("vi")
      ? ["I", "II", "III", "IV"][quarter - 1]
      : quarter,
  ]);
}
export function quarterDeadline(endDate: string) {
  const date = new Date(`${endDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 14);
  return date.toISOString().slice(0, 10);
}
export function scheduleDefaults(day: string, item?: PerformanceView) {
  const source = item?.startDate ?? day;
  const quarter =
    item?.period?.quarter ??
    Math.floor((Number(source.slice(5, 7)) - 1) / 3) + 1;
  const year = item?.period?.year ?? Number(source.slice(0, 4));
  const range = performanceQuarter({ quarter, year });
  const legacy =
    item &&
    !item.period &&
    (item.startDate !== range.startDate || item.endDate !== range.endDate);
  return {
    quarter: legacy ? 0 : quarter,
    year,
    managerDue: item?.managerDue ?? quarterDeadline(range.endDate),
  };
}
export const performancePlanningSchema = z
  .object({
    employeeId: z.string().min(1),
    schedule: z.object({
      quarter: z.number().int().min(1, "Chọn quý đánh giá.").max(4),
      year: z.number().int().min(2000).max(2100),
      managerDue: z.string(),
    }),
    goals: z.array(performanceGoalSchema).min(1).max(6),
    version: z.number().int().min(0),
  })
  .transform((input, ctx) => {
    const { schedule, ...rest } = input;
    const period = { quarter: schedule.quarter, year: schedule.year };
    const parsed = performanceSetupSchema.safeParse({
      ...rest,
      period,
      ...performanceQuarter(period),
      managerDue: schedule.managerDue,
    });
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) =>
        ctx.addIssue({
          code: "custom",
          path: [issue.path[0] === "goals" ? "goals" : "schedule"],
          message: issue.message,
        }),
      );
      return z.NEVER;
    }
    return parsed.data;
  });
export type ReviewSchedule = z.input<
  typeof performancePlanningSchema
>["schedule"];
export function newQualitativeGoal(): PerformanceGoal {
  return {
    id: crypto.randomUUID(),
    kind: "qualitative",
    title: "",
    expectation: "",
    priority: "standard",
    weight: 100,
  };
}
export function convertLegacyGoals(
  goals: PerformanceGoal[],
): PerformanceGoal[] {
  return balancePerformanceGoals(
    goals.map((g) =>
      g.kind === "qualitative"
        ? g
        : {
            id: g.id,
            kind: "qualitative",
            title: g.title,
            expectation: `${g.direction === "higher" ? "≥" : "≤"} ${g.target} ${g.unit}`,
            priority: "standard",
            weight: 100,
          },
    ),
  );
}
