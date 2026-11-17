import { recruitmentRewardSchema, salaryPackageSchema } from "../compensation";
import { z } from "zod";
import {
  recruitmentAssessmentSchema,
  type RecruitmentAssessment,
} from "./recruitment-assessment";
export * from "./recruitment-assessment";
import type { Meta, Schedule } from "../index";
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    "Ngày không hợp lệ",
  );
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const reason = z.string().trim().min(5, "Nhập ít nhất 5 ký tự").max(1000);
export const approvalStatuses = [
  "pending_manager",
  "pending_hr",
  "approved",
  "rejected",
  "cancelled",
] as const;
export type ApprovalStatus = (typeof approvalStatuses)[number];
export interface WorkflowEvent {
  action: string;
  at: string;
  by: string;
  name: string;
  reason: string;
}
export interface ApprovalRecord extends Meta {
  employeeId: string;
  managerId: string;
  status: ApprovalStatus;
  version: number;
  history: WorkflowEvent[];
  managerApprovedBy: string;
}
export const workRegistrationSchema = z
  .object({
    date: day,
    start: clock,
    end: clock,
    reason,
    version: z.number().int().min(0).default(0),
  })
  .strict();
export type WorkRegistrationInput = z.infer<typeof workRegistrationSchema>;
export interface WorkRegistration extends ApprovalRecord {
  date: string;
  start: string;
  end: string;
  reason: string;
  schedule: Schedule;
}
export const reviewSchema = z
  .object({ version: z.number().int().positive(), reason })
  .strict();
export const requestKinds = [
  "attendance_correction",
  "business_trip",
  "remote_work",
  "employment_certificate",
  "equipment",
  "training",
  "expense_reimbursement",
  "benefit_support",
] as const;
export const requestLabels: Record<(typeof requestKinds)[number], string> = {
  attendance_correction: "Điều chỉnh chấm công",
  business_trip: "Đề nghị công tác",
  remote_work: "Làm việc từ xa",
  employment_certificate: "Xác nhận thông tin nhân sự",
  equipment: "Cấp thiết bị làm việc",
  training: "Đề nghị đào tạo",
  expense_reimbursement: "Thanh toán chi phí",
  benefit_support: "Hỗ trợ phúc lợi",
};
export const requestGroups = [
  {
    label: "Thời gian & công việc",
    kinds: ["attendance_correction", "business_trip", "remote_work"],
  },
  {
    label: "Hồ sơ & phát triển",
    kinds: ["employment_certificate", "equipment", "training"],
  },
  {
    label: "Chi phí & phúc lợi",
    kinds: ["expense_reimbursement", "benefit_support"],
  },
] satisfies { label: string; kinds: (typeof requestKinds)[number][] }[];
export const internalRequestSchema = z
  .object({
    kind: z.enum(requestKinds),
    resource: z.string().trim().max(200).default(""),
    quantity: z.number().int().min(1).max(100).default(1),
    amount: z
      .number()
      .int()
      .positive()
      .max(1_000_000_000)
      .nullable()
      .default(null),
    reference: z.string().trim().max(500).default(""),
    title: z.string().trim().min(3).max(150),
    reason,
    startDate: day,
    endDate: day,
    location: z.string().trim().max(300).default(""),
    checkIn: z.union([clock, z.literal("")]).default(""),
    checkOut: z.union([clock, z.literal("")]).default(""),
  })
  .strict()
  .refine(
    (v) =>
      v.startDate <= v.endDate &&
      Date.parse(v.endDate) - Date.parse(v.startDate) <= 31 * 86400000,
    "Khoảng ngày tối đa 31 ngày",
  )
  .superRefine((value, ctx) => {
    const required = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });
    if (
      ["equipment", "training", "benefit_support"].includes(value.kind) &&
      value.resource.length < 3
    )
      required("resource", "Nhập nội dung cần đề nghị");
    if (value.kind === "expense_reimbursement") {
      if (!value.amount) required("amount", "Nhập số tiền đề nghị");
      if (value.reference.length < 3)
        required("reference", "Nhập mã hoặc đường dẫn chứng từ");
    }
    if (
      !["training", "expense_reimbursement", "benefit_support"].includes(
        value.kind,
      ) &&
      value.amount !== null
    )
      required("amount", "Loại đề nghị này không có số tiền");
    if (value.kind !== "equipment" && value.quantity !== 1)
      required("quantity", "Số lượng chỉ áp dụng cho thiết bị");
  });
type RequestDetails = "resource" | "quantity" | "amount" | "reference";
export type InternalRequestInput = Omit<
  z.infer<typeof internalRequestSchema>,
  RequestDetails
> &
  Partial<Pick<z.infer<typeof internalRequestSchema>, RequestDetails>>;
export interface InternalRequest extends ApprovalRecord, InternalRequestInput {
  attendanceBefore: { checkIn: string; checkOut: string | null } | null;
  resolution: string;
}
export interface ApprovalView {
  employeeName: string;
  employeeCode: string;
  managerName: string;
  canReview: boolean;
  canCancel: boolean;
}
export type WorkRegistrationView = WorkRegistration & ApprovalView;
export type InternalRequestView = InternalRequest & ApprovalView;
export const stageSchema = z
  .object({
    id,
    name: z.string().trim().min(2).max(80),
    kind: z.enum(["screening", "interview", "decision"]),
  })
  .strict();
export type RecruitmentStage = z.infer<typeof stageSchema>;
export const defaultRecruitmentStages: RecruitmentStage[] = [
  { id: "screening", name: "Sơ tuyển hồ sơ", kind: "screening" },
  { id: "interview-1", name: "Phỏng vấn chuyên môn", kind: "interview" },
  { id: "interview-2", name: "Phỏng vấn văn hóa", kind: "interview" },
  { id: "decision", name: "Quyết định", kind: "decision" },
];
export const recruitmentJobSchema = z
  .object({
    title: z.string().trim().min(3).max(150),
    departmentId: id,
    hiringManagerId: id,
    description: z.string().trim().max(4000),
    openings: z.number().int().min(1).max(100),
    rewards: recruitmentRewardSchema.optional(),
    stages: z.array(stageSchema).min(2).max(8),
    active: z.boolean().default(true),
    version: z.number().int().min(0).default(0),
  })
  .strict()
  .refine(
    (v) =>
      new Set(v.stages.map((s) => s.id)).size === v.stages.length &&
      v.stages[0].kind === "screening" &&
      v.stages.at(-1)?.kind === "decision" &&
      v.stages.slice(1, -1).every((s) => s.kind === "interview"),
    "Bắt đầu bằng sơ tuyển, kết thúc bằng quyết định; các vòng ở giữa là phỏng vấn",
  );
export type RecruitmentJobInput = z.infer<typeof recruitmentJobSchema>;
export interface RecruitmentJob extends Meta, RecruitmentJobInput {}
export const candidateSchema = z
  .object({
    jobId: id,
    name: z.string().trim().min(2).max(150),
    email: z.email(),
    phone: z.string().trim().min(8).max(30),
    address: z.string().trim().max(300).default(""),
    education: z.string().trim().min(2).max(4000),
    experience: z.string().trim().min(2).max(6000),
    skills: z.string().trim().max(2000),
    source: z.enum(["application", "referral", "sourced", "sample"]),
    note: z.string().trim().max(2000).default(""),
  })
  .strict();
export const candidateEditSchema = candidateSchema.extend({
  version: z.number().int().positive(),
});
export type CandidateInput = z.infer<typeof candidateSchema>;
export const candidateHireSchema = reviewSchema.extend({
  positionId: id,
  hireDate: day,
  workEmail: z
    .email("Nhập email công việc hợp lệ")
    .transform((v) => v.toLowerCase()),
  employmentStatus: z.enum(["probation", "active"]).default("probation"),
  compensation: salaryPackageSchema.nullable().optional(),
});
export type CandidateHireInput = z.infer<typeof candidateHireSchema>;
export const interviewSchema = z
  .object({
    version: z.number().int().positive(),
    date: day,
    start: clock,
    end: clock,
    interviewerId: id,
    location: z.string().trim().min(3).max(300),
  })
  .strict();
export const evaluationSchema = z
  .object({
    version: z.number().int().positive(),
    result: z.enum(["passed", "failed"]),
    score: z.number().int().min(1).max(5).optional(),
    assessment: recruitmentAssessmentSchema.optional(),
    reason,
  })
  .strict()
  .refine(
    (value) => value.assessment !== undefined || value.score !== undefined,
    {
      message: "Cần có phiếu đánh giá hoặc điểm đánh giá.",
      path: ["assessment"],
    },
  );
export const candidateTransitionSchema = z
  .object({ version: z.number().int().positive(), stageId: id, reason })
  .strict();
export interface Interview {
  date: string;
  start: string;
  end: string;
  interviewerId: string;
  interviewerName: string;
  location: string;
  status: "proposed" | "confirmed";
  confirmedBy: string;
}
export interface EvaluationRevision {
  result: "passed" | "failed";
  score?: number;
  assessment?: RecruitmentAssessment;
  feedback?: string;
  evaluatedBy?: string;
  evaluatedAt?: string;
}
export interface CandidateRound {
  evaluationHistory?: EvaluationRevision[];
  stageId: string;
  stageName: string;
  interview?: Interview;
  result?: "passed" | "failed";
  score?: number;
  assessment?: RecruitmentAssessment;
  feedback?: string;
  evaluatedBy?: string;
  evaluatedAt?: string;
}
export interface Candidate extends Meta, CandidateInput {
  employeeId?: string;
  stageId: string;
  status: "active" | "hired" | "rejected";
  version: number;
  rounds: CandidateRound[];
  interviewDates: string[];
  history: WorkflowEvent[];
  cv: { name: string; size: number; chunks: number; sha256: string } | null;
}
export interface CandidateFile extends Meta {
  candidateId: string;
  data: string;
}
export const workflowLabels: Record<string, string> = {
  employee_created: "Đã tạo hồ sơ nhân viên",
  work_item_created: "Tạo công việc",
  work_item_updated: "Cập nhật công việc",
  work_item_start: "Bắt đầu xử lý",
  work_item_submit: "Gửi rà soát",
  work_item_approve: "Nghiệm thu",
  work_item_return: "Yêu cầu bổ sung",
  work_item_cancel: "Hủy công việc",
  pending_manager: "Chờ quản lý duyệt",
  pending_hr: "Chờ xác nhận cuối",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  cancelled: "Đã hủy",
  submitted: "Gửi đề nghị",
  manager_approved: "Quản lý đã duyệt",
  approved_final: "Xác nhận cấp cuối",
  updated: "Cập nhật hồ sơ",
  created: "Tiếp nhận hồ sơ",
  moved: "Chuyển vòng",
  passed: "Đạt yêu cầu",
  failed: "Chưa đạt",
  hired: "Trúng tuyển",
  direct_hired: "Tuyển thẳng",
  interview_scheduled: "Đề xuất lịch phỏng vấn",
  interview_confirmed: "Đã duyệt lịch phỏng vấn",
  cv_uploaded: "Cập nhật CV",
  application: "Ứng tuyển",
  referral: "Giới thiệu",
  sourced: "Tìm kiếm ứng viên",
  sample: "Hồ sơ mẫu",
};
