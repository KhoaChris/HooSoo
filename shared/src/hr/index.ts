import { z } from "zod";
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
] as const;
export const requestLabels: Record<(typeof requestKinds)[number], string> = {
  attendance_correction: "Điều chỉnh chấm công",
  business_trip: "Đề nghị công tác",
  remote_work: "Làm việc từ xa",
  employment_certificate: "Xác nhận thông tin nhân sự",
};
export const internalRequestSchema = z
  .object({
    kind: z.enum(requestKinds),
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
  );
export type InternalRequestInput = z.infer<typeof internalRequestSchema>;
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
    score: z.number().int().min(1).max(5),
    reason,
  })
  .strict();
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
export interface CandidateRound {
  stageId: string;
  stageName: string;
  interview?: Interview;
  result?: "passed" | "failed";
  score?: number;
  feedback?: string;
  evaluatedBy?: string;
  evaluatedAt?: string;
}
export interface Candidate extends Meta, CandidateInput {
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
