import { z } from "zod";
import type { Meta, WorkflowEvent } from "../index";
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Ngày không hợp lệ",
  );
const note = z.string().trim().min(5, "Nhập ít nhất 5 ký tự").max(1000);
export const performanceCompetencies = [
  { id: "quality", label: "Chất lượng công việc" },
  { id: "ownership", label: "Trách nhiệm & chủ động" },
  { id: "teamwork", label: "Phối hợp đội ngũ" },
  { id: "growth", label: "Học hỏi & phát triển" },
] as const;
export const performanceLevels = [
  "Dưới kỳ vọng",
  "Cần phát triển",
  "Đạt kỳ vọng",
  "Trên kỳ vọng",
  "Vượt trội",
];
export const performanceStatusLabels = {
  draft: "Chuẩn bị mục tiêu",
  self_review: "Chờ quản lý đánh giá",
  ready: "Chờ công bố",
  report_revision: "Chờ bổ sung báo cáo",
  pending_report: "Cấp trên đang xem xét",
  manager_review: "Chờ quản lý đánh giá",
  hr_review: "Chờ công bố",
  completed: "Đã chốt",
  acknowledged: "Đã xác nhận",
  cancelled: "Đã hủy",
} as const;
export const performanceHistoryLabels: Record<string, string> = {
  report_submitted: "Gửi báo cáo cấp trên",
  report_returned: "Cấp trên trả lại báo cáo",
  report_finalized: "Cấp trên chốt báo cáo",
  created: "Tạo kỳ đánh giá",
  updated: "Cập nhật mục tiêu",
  launch: "Mở đánh giá",
  self_saved: "Lưu tự đánh giá",
  self_submitted: "Gửi tự đánh giá",
  manager_saved: "Lưu đánh giá quản lý",
  manager_submitted: "Gửi đánh giá quản lý",
  return_self: "Yêu cầu tự đánh giá lại",
  return_manager: "Yêu cầu quản lý bổ sung",
  finalize: "Chốt kết quả",
  acknowledge: "Xác nhận kết quả",
  cancel: "Hủy kỳ đánh giá",
};
export const performanceActions = {
  launch: "Mở đánh giá",
  self: "Tự đánh giá",
  manager: "Đánh giá nhân viên",
  finalize: "Chốt kết quả",
  return_self: "Yêu cầu tự đánh giá lại",
  return_manager: "Yêu cầu quản lý bổ sung",
  acknowledge: "Xác nhận kết quả",
  cancel: "Hủy kỳ đánh giá",
} as const;
export const performanceOutcomes = [
  "below",
  "developing",
  "meets",
  "exceeds",
  "outstanding",
] as const;
export const performanceOutcomeLabels = Object.fromEntries(
  performanceOutcomes.map((value, index) => [value, performanceLevels[index]]),
) as Record<(typeof performanceOutcomes)[number], string>;
export const performancePriorities = {
  standard: "Thông thường",
  important: "Quan trọng",
  critical: "Trọng tâm",
} as const;
export const performancePeriodSchema = z
  .object({
    quarter: z.number().int().min(1).max(4),
    year: z.number().int().min(2000).max(2100),
  })
  .strict();
export function performanceQuarter(
  period: z.infer<typeof performancePeriodSchema>,
) {
  const { quarter, year } = performancePeriodSchema.parse(period);
  return {
    title: `Quý ${["I", "II", "III", "IV"][quarter - 1]} / ${year}`,
    startDate: `${year}-${["01-01", "04-01", "07-01", "10-01"][quarter - 1]}`,
    endDate: `${year}-${["03-31", "06-30", "09-30", "12-31"][quarter - 1]}`,
  };
}
const goalBase = {
  id,
  title: z.string().trim().min(3).max(180),
  weight: z.number().int().min(1).max(100),
};
export const performanceGoalSchema = z.union([
  z
    .object({
      ...goalBase,
      kind: z.literal("qualitative"),
      expectation: note,
      priority: z.enum(["standard", "important", "critical"]),
    })
    .strict(),
  z
    .object({
      ...goalBase,
      unit: z.string().trim().min(1).max(30),
      target: z.number().positive().max(1e9),
      direction: z.enum(["higher", "lower"]),
      kind: z.literal("numeric").optional(),
    })
    .strict(),
]);
export type PerformanceGoal = z.infer<typeof performanceGoalSchema>;
/** Largest-remainder allocation keeps integer weights totaling exactly 100. */
export function balancePerformanceGoals(
  goals: PerformanceGoal[],
): PerformanceGoal[] {
  if (!goals.length) return [];
  const priorities = { standard: 1, important: 2, critical: 3 };
  const points = goals.map((g) =>
    g.kind === "qualitative" ? priorities[g.priority] : g.weight,
  );
  const total = points.reduce((sum, value) => sum + value, 0);
  const exact = points.map((value) => (value * 100) / total);
  const weights = exact.map(Math.floor);
  const order = exact
    .map((value, index) => ({ index, remainder: value - weights[index] }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  const remaining = 100 - weights.reduce((sum, value) => sum + value, 0);
  for (let n = 0; n < remaining; n++) weights[order[n].index]++;
  return goals.map((g, index) => ({ ...g, weight: weights[index] }));
}
export const performanceSetupSchema = z
  .object({
    employeeId: id,
    period: performancePeriodSchema.optional(),
    title: z.string().trim().min(3).max(160),
    startDate: day,
    endDate: day,
    selfDue: day.optional(),
    managerDue: day,
    version: z.number().int().min(0).default(0),
    goals: z.array(performanceGoalSchema).min(1).max(6),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.period && performancePeriodSchema.safeParse(v.period).success) {
      const expected = performanceQuarter(v.period);
      for (const key of ["title", "startDate", "endDate"] as const) {
        if (v[key] !== expected[key])
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: "Kỳ đánh giá phải khớp quý và năm đã chọn.",
          });
      }
    }
    if (v.goals.some((g) => g.kind === "qualitative")) {
      if (!v.period)
        ctx.addIssue({
          code: "custom",
          path: ["period"],
          message: "Chọn quý và năm đánh giá.",
        });
      if (v.goals.some((g) => g.kind !== "qualitative"))
        ctx.addIssue({
          code: "custom",
          path: ["goals"],
          message: "Sử dụng cùng cách đánh giá cho tất cả mục tiêu.",
        });
      const balanced = balancePerformanceGoals(v.goals);
      if (v.goals.some((g, i) => g.weight !== balanced[i].weight))
        ctx.addIssue({
          code: "custom",
          path: ["goals"],
          message: "Tỷ trọng được tính theo mức ưu tiên của mục tiêu.",
        });
    }
    if (!(v.startDate <= v.endDate && v.endDate <= v.managerDue))
      ctx.addIssue({
        code: "custom",
        path: ["managerDue"],
        message: "Thứ tự: bắt đầu → kết thúc → hạn đánh giá",
      });
    if (
      v.goals.reduce((s, g) => s + g.weight, 0) !== 100 ||
      new Set(v.goals.map((g) => g.id)).size !== v.goals.length
    )
      ctx.addIssue({
        code: "custom",
        path: ["goals"],
        message: "Trọng số mục tiêu phải đủ 100% và không trùng mã",
      });
  });
export const performanceAssessmentSchema = z
  .object({
    goals: z
      .array(
        z
          .object({
            goalId: id,
            actual: z.number().min(0).max(1e9).nullable(),
            outcome: z.enum(performanceOutcomes).optional(),
            evidence: note,
          })
          .strict()
          .refine((v) => (v.outcome ? v.actual === null : v.actual !== null), {
            path: ["outcome"],
            message: "Chọn mức đánh giá và ghi nhận xét.",
          }),
      )
      .min(1)
      .max(6),
    competencies: z
      .array(
        z
          .object({
            criterionId: id,
            rating: z.number().int().min(1).max(5),
            evidence: note,
          })
          .strict(),
      )
      .length(4),
    strengths: note,
    improvements: note,
    developmentPlan: note,
  })
  .strict();
export const performanceDraftSchema = z
  .object({
    goals: z
      .array(
        z
          .object({
            goalId: id,
            actual: z.number().min(0).max(1e9).nullable(),
            outcome: z.enum(performanceOutcomes).optional(),
            evidence: z.string().trim().max(1000),
          })
          .strict()
          .refine((v) => !v.outcome || v.actual === null, {
            path: ["actual"],
            message: "Chỉ sử dụng một cách đánh giá mục tiêu.",
          }),
      )
      .min(1)
      .max(6),
    competencies: z
      .array(
        z
          .object({
            criterionId: id,
            rating: z.number().int().min(0).max(5),
            evidence: z.string().trim().max(1000),
          })
          .strict(),
      )
      .length(4),
    strengths: z.string().trim().max(1000),
    improvements: z.string().trim().max(1000),
    developmentPlan: z.string().trim().max(1000),
  })
  .strict();
export type PerformanceDraft = z.infer<typeof performanceDraftSchema>;
export const performanceSaveSchema = z
  .object({
    version: z.number().int().positive(),
    submit: z.boolean(),
    assessment: performanceDraftSchema,
    reason: z.string().trim().max(1000).default(""),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.submit) {
      const full = performanceAssessmentSchema.safeParse(v.assessment);
      if (!full.success)
        full.error.issues.forEach((issue) =>
          ctx.addIssue({
            code: "custom",
            path: ["assessment", ...issue.path],
            message: "Hoàn tất kết quả và minh chứng trước khi gửi.",
          }),
        );
    }
  });
export const performanceActionSchema = z
  .object({ version: z.number().int().positive(), reason: note })
  .strict();
export type PerformanceSetup = z.infer<typeof performanceSetupSchema>;
export type PerformanceAssessment = z.infer<typeof performanceAssessmentSchema>;
export type PerformanceAction = keyof typeof performanceActions;
export interface SavedPerformanceAssessment {
  data: PerformanceDraft;
  by: string;
  name: string;
  at: string;
  submitted: boolean;
  score: number | null;
}
export interface PerformanceReview extends Meta, PerformanceSetup {
  evaluatorId?: string;
  reportId?: string;
  revisionEditorId?: string;
  requiredReviewerId?: string;
  status: keyof typeof performanceStatusLabels;
  selfAssessment: SavedPerformanceAssessment | null;
  managerAssessment: SavedPerformanceAssessment | null;
  finalNote: string;
  finalBy: string;
  finalAt: string;
  history: WorkflowEvent[];
  revisions: {
    phase: "self" | "manager";
    assessment: SavedPerformanceAssessment;
  }[];
}
export interface PerformanceView extends PerformanceReview {
  employeeName: string;
  employeeCode: string;
  canEdit: boolean;
  actions: PerformanceAction[];
  reviewerName: string;
  canReport: boolean;
}
export interface PerformanceWorkspace {
  items: PerformanceView[];
  people: { id: string; name: string; employeeCode: string }[];
  canCreate: boolean;
  reports: PerformanceReportView[];
  reportRecipients: { id: string; name: string; employeeIds: string[] }[];
}
export function performanceScore(
  setup: Pick<PerformanceSetup, "goals">,
  input: PerformanceAssessment,
) {
  const a = performanceAssessmentSchema.parse(input);
  if (
    a.goals.length !== setup.goals.length ||
    new Set(a.goals.map((x) => x.goalId)).size !== setup.goals.length ||
    setup.goals.some((g) => !a.goals.some((x) => x.goalId === g.id))
  )
    throw new Error("Đánh giá đầy đủ các mục tiêu đã giao");
  if (
    new Set(a.competencies.map((x) => x.criterionId)).size !== 4 ||
    performanceCompetencies.some(
      (c) => !a.competencies.some((x) => x.criterionId === c.id),
    )
  )
    throw new Error("Đánh giá đủ bốn năng lực");
  const goals = setup.goals.reduce((sum, g) => {
    const result = a.goals.find((x) => x.goalId === g.id)!;
    if (result.outcome)
      return (
        sum + ((performanceOutcomes.indexOf(result.outcome) + 1) / 5) * g.weight
      );
    if (g.kind === "qualitative" || result.actual === null)
      throw new Error("Chọn mức đánh giá cho từng mục tiêu.");
    const actual = result.actual;
    const ratio =
      g.direction === "higher"
        ? actual / g.target
        : actual === 0
          ? 1
          : g.target / actual;
    return sum + Math.min(1, ratio) * g.weight;
  }, 0);
  const competencies = a.competencies.reduce(
    (sum, c) => sum + (c.rating / 5) * 25,
    0,
  );
  return Math.round(goals * 0.7 + competencies * 0.3);
}

export const performanceReportSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    reviewerId: id,
    reason: note,
    reviews: z
      .array(z.object({ id, version: z.number().int().positive() }).strict())
      .min(1)
      .max(20),
  })
  .strict()
  .refine(
    (v) => new Set(v.reviews.map((r) => r.id)).size === v.reviews.length,
    "Không chọn trùng đánh giá",
  );
export type PerformanceReportInput = z.infer<typeof performanceReportSchema>;
export const performanceReportLabels = {
  pending: "Chờ cấp trên xem xét",
  returned: "Đã trả lại",
  finalized: "Đã quyết định",
} as const;
export interface PerformanceReport extends Meta {
  title: string;
  senderId: string;
  reviewerId: string;
  reviewIds: string[];
  submittedVersions: Record<string, number>;
  status: keyof typeof performanceReportLabels;
  version: number;
  reason: string;
  decisionNote: string;
  history: WorkflowEvent[];
}
export interface PerformanceReportView extends PerformanceReport {
  senderName: string;
  reviewerName: string;
  canDecide: boolean;
}
