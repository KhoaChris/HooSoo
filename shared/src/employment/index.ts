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
const text = z.string().trim().min(3, "Nhập ít nhất 3 ký tự").max(2000);
const version = z.number().int().min(0).default(0);
export const employmentSections = [
  "contracts",
  "probations",
  "onboarding",
] as const;
export type EmploymentSection = (typeof employmentSections)[number];
export const employmentTables = {
  contracts: "employmentContracts",
  probations: "probationReviews",
  onboarding: "onboardingPlans",
} as const;
export const contractTypes = {
  fixed_term: "Có thời hạn",
  indefinite: "Không thời hạn",
  internship: "Thực tập",
} as const;
export const contractSchema = z
  .object({
    employeeId: id,
    kind: z.enum(["fixed_term", "indefinite", "internship"]),
    title: text.max(200),
    startDate: day,
    endDate: z.union([day, z.literal("")]),
    documentUrl: z
      .union([
        z.literal(""),
        z
          .url()
          .refine(
            (v) => ["http:", "https:"].includes(new URL(v).protocol),
            "Chỉ dùng liên kết HTTP/HTTPS",
          ),
      ])
      .default(""),
    notes: z.string().trim().max(2000).default(""),
    version,
  })
  .strict()
  .refine(
    (v) =>
      v.kind === "indefinite"
        ? !v.endDate
        : !!v.endDate && v.endDate >= v.startDate,
    { path: ["endDate"], message: "Chọn ngày kết thúc hợp lệ" },
  );
export const probationSchema = z
  .object({
    employeeId: id,
    startDate: day,
    endDate: day,
    objectives: text,
    version,
  })
  .strict()
  .refine((v) => v.endDate >= v.startDate, {
    path: ["endDate"],
    message: "Ngày kết thúc không hợp lệ",
  });
export const competencyLabels = {
  quality: "Chất lượng công việc",
  delivery: "Tiến độ & trách nhiệm",
  collaboration: "Phối hợp & giao tiếp",
  independence: "Khả năng tự chủ",
} as const;
export const ratingLabels = {
  developing: "Cần cải thiện",
  meets: "Đáp ứng",
  exceeds: "Vượt kỳ vọng",
} as const;
const rating = z.enum(["developing", "meets", "exceeds"]);
export const probationReviewSchema = z
  .object({
    version: z.number().int().positive(),
    quality: rating,
    delivery: rating,
    collaboration: rating,
    independence: rating,
    strengths: text,
    improvements: text,
    recommendation: z.enum(["confirm", "extend", "decline"]),
  })
  .strict();
export const employmentActionSchema = z
  .object({
    version: z.number().int().positive(),
    reason: text,
    endDate: z.union([day, z.literal("")]).default(""),
  })
  .strict();
export const onboardingOwners = {
  employee: "Nhân viên",
  manager: "Quản lý",
  hr: "Nhân sự",
} as const;
export const onboardingSchema = z
  .object({ employeeId: id, startDate: day })
  .strict();
export const onboardingTaskSchema = z
  .object({
    version: z.number().int().positive(),
    title: text.max(150),
    owner: z.enum(["employee", "manager", "hr"]),
    dueDate: day,
  })
  .strict();
export const onboardingTaskActionSchema = z
  .object({
    version: z.number().int().positive(),
    taskId: id,
    done: z.boolean(),
    note: z.string().trim().max(1000).default(""),
  })
  .strict();
export type ContractInput = z.infer<typeof contractSchema>;
export type ProbationInput = z.infer<typeof probationSchema>;
export type ProbationAssessment = z.infer<typeof probationReviewSchema> & {
  by: string;
  at: string;
  name: string;
};
export type EmploymentActionInput = z.infer<typeof employmentActionSchema>;
export interface EmploymentRecord extends Meta {
  employeeId: string;
  version: number;
  history: WorkflowEvent[];
}
export interface EmploymentContract extends EmploymentRecord, ContractInput {
  reference: string;
  status: "draft" | "active" | "ended" | "cancelled";
  acknowledgedAt: string;
  acknowledgedBy: string;
}
export interface ProbationReview extends EmploymentRecord, ProbationInput {
  status: "in_progress" | "in_review" | "confirmed" | "declined";
  assessment: ProbationAssessment | null;
  assessments: ProbationAssessment[];
  selfReview: string;
  decision: string;
}
export interface OnboardingTask {
  id: string;
  title: string;
  owner: keyof typeof onboardingOwners;
  dueDate: string;
  completedAt: string;
  completedBy: string;
  note: string;
}
export interface OnboardingPlan extends EmploymentRecord {
  startDate: string;
  status: "in_progress" | "completed";
  tasks: OnboardingTask[];
}
export type EmploymentItem =
  EmploymentContract | ProbationReview | OnboardingPlan;
export type EmploymentAction =
  | "activate"
  | "acknowledge"
  | "end"
  | "cancel"
  | "review"
  | "self-review"
  | "confirm"
  | "extend"
  | "decline"
  | "return"
  | "complete"
  | "reopen";
export const employmentActionLabels: Record<EmploymentAction, string> = {
  activate: "Phát hành hợp đồng",
  acknowledge: "Xác nhận đã nhận",
  end: "Kết thúc hợp đồng",
  cancel: "Hủy hợp đồng",
  review: "Đánh giá thử việc",
  "self-review": "Tự đánh giá",
  confirm: "Xác nhận chính thức",
  extend: "Gia hạn thử việc",
  decline: "Không đạt thử việc",
  return: "Yêu cầu đánh giá lại",
  complete: "Hoàn tất tiếp nhận",
  reopen: "Mở lại checklist",
};
export const employmentStatusLabels: Record<string, string> = {
  draft: "Bản nháp",
  active: "Đã phát hành",
  ended: "Đã kết thúc",
  cancelled: "Đã hủy",
  in_progress: "Đang thực hiện",
  in_review: "Chờ HR xác nhận",
  confirmed: "Đạt thử việc",
  declined: "Không đạt",
  completed: "Đã hoàn tất",
  expired: "Hết hạn",
  expiring: "Sắp hết hạn",
};
export type EmploymentView = EmploymentItem & {
  employeeName: string;
  employeeCode: string;
  canEdit: boolean;
  actions: EmploymentAction[];
  editableTasks: string[];
  canAddTask: boolean;
};
export interface EmploymentWorkspace {
  items: EmploymentView[];
  people: { id: string; name: string; employeeCode: string; status: string }[];
  canCreate: boolean;
}
export function contractPhase(c: EmploymentContract, today: string) {
  if (c.status !== "active" || !c.endDate) return c.status;
  if (c.endDate < today) return "expired";
  return Date.parse(c.endDate) - Date.parse(today) <= 30 * 86400000
    ? "expiring"
    : "active";
}
export function onboardingProgress(plan: OnboardingPlan) {
  return plan.tasks.length
    ? Math.round(
        (plan.tasks.filter((t) => t.completedAt).length * 100) /
          plan.tasks.length,
      )
    : 0;
}
