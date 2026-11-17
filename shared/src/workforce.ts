import { z } from "zod";
import type { Meta, WorkflowEvent, EmployeeInput, Schedule } from "./index";

export const workforceDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Ngày không hợp lệ",
  );
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const reason = z.string().trim().min(5, "Nhập ít nhất 5 ký tự").max(2000);
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const version = z.number().int().nonnegative();
export const workforceActionSchema = z.object({ version, reason }).strict();
export type WorkforceAction = z.infer<typeof workforceActionSchema>;
export interface WorkforceRecord extends Meta {
  version: number;
  history: WorkflowEvent[];
}
export const timeRequestSchema = z
  .object({
    kind: z.enum(["overtime", "hourly_leave"]),
    date: workforceDay,
    start: clock,
    end: clock,
    leaveTypeId: z.union([id, z.literal("")]).default(""),
    reason,
  })
  .strict()
  .refine((v) => v.start < v.end, {
    path: ["end"],
    message: "Giờ kết thúc phải sau giờ bắt đầu",
  });
export type TimeRequestInput = z.infer<typeof timeRequestSchema>;
export interface TimeRequest extends WorkforceRecord, TimeRequestInput {
  employeeId: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  minutes: number;
  days: number;
  deductsBalance: boolean;
  schedule: Schedule;
  reviewedBy: string;
}
export interface PayrollSource {
  baseAmount: number;
  allowanceAmount: number;
  scheduledDays: number;
  employmentDays: number;
  attendanceMinutes: number;
  paidLeaveDays: number;
  overtimeMinutes: number;
  hourlyLeaveMinutes: number;
  missingAttendanceDates: string[];
  sources: { id: string; version: number; kind: string }[];
  fingerprint: string;
}
const adjustment = z
  .object({
    label: z.string().trim().min(3).max(120),
    amount: z.number().int().positive().max(1_000_000_000),
  })
  .strict();
export const payrollSetupSchema = z
  .object({
    employeeId: id,
    period: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/),
    version,
    earnings: z.array(adjustment).max(12),
    deductions: z.array(adjustment).max(12),
    overtimeRate: z.number().int().min(0).max(100_000_000),
    reason,
  })
  .strict();
export type PayrollSetup = z.infer<typeof payrollSetupSchema>;
export interface PayrollStatement extends WorkforceRecord, PayrollSetup {
  preparedBy: string;
  status: "draft" | "review" | "approved" | "published" | "voided";
  source: PayrollSource;
  totalEarnings: number;
  totalDeductions: number;
  netAmount: number;
  approvedBy: string;
  publishedAt: string;
  revisions: {
    version: number;
    netAmount: number;
    source: PayrollSource;
    reason: string;
    at: string;
  }[];
}
export const personnelChangeSchema = z
  .object({
    employeeId: id,
    kind: z.enum(["transfer", "promotion"]),
    departmentId: id,
    positionId: id,
    managerId: z.union([id, z.literal("")]),
    effectiveDate: workforceDay,
    salaryRecordId: z.union([id, z.literal("")]).default(""),
    contractId: z.union([id, z.literal("")]).default(""),
    reason,
    version,
  })
  .strict();
export type PersonnelChangeInput = z.infer<typeof personnelChangeSchema>;
export interface PersonnelChange extends WorkforceRecord, PersonnelChangeInput {
  preparedBy: string;
  status:
    "draft" | "pending" | "approved" | "applied" | "rejected" | "cancelled";
  before: { departmentId: string; positionId: string; managerId: string };
  approvedBy: string;
}
export const documentCategories = {
  qualification: "Bằng cấp & chứng chỉ",
  contract: "Hợp đồng & phụ lục",
  identity: "Giấy tờ cá nhân",
  employment_letter: "Xác nhận công tác",
  other: "Tài liệu khác",
} as const;
export const personnelDocumentSchema = z
  .object({
    employeeId: id,
    title: z.string().trim().min(3).max(150),
    category: z.enum([
      "qualification",
      "contract",
      "identity",
      "employment_letter",
      "other",
    ]),
    expiresOn: z.union([workforceDay, z.literal("")]).default(""),
    fileName: z.string().trim().min(1).max(150),
    mime: z.enum(["application/pdf", "image/png", "image/jpeg"]),
    data: z.string().min(4).max(700_000),
    version,
    reason,
  })
  .strict();
export type PersonnelDocumentInput = z.infer<typeof personnelDocumentSchema>;
export interface PersonnelDocument extends WorkforceRecord {
  employeeId: string;
  title: string;
  category: keyof typeof documentCategories;
  expiresOn: string;
  status: "active" | "archived";
  files: {
    version: number;
    fileName: string;
    mime: string;
    bytes: number;
    objectKey: string;
    sha256: string;
    uploadedAt: string;
    uploadedBy: string;
  }[];
  sourceRequestId?: string;
}
export const announcementSchema = z
  .object({
    title: z.string().trim().min(3).max(180),
    body: z.string().trim().min(10).max(12000),
    kind: z.enum(["announcement", "policy"]),
    departmentIds: z.array(id).max(25),
    requiresAcknowledgement: z.boolean(),
    pinned: z.boolean(),
    publishOn: workforceDay,
    expiresOn: z.union([workforceDay, z.literal("")]),
    version,
  })
  .strict()
  .refine((v) => !v.expiresOn || v.expiresOn >= v.publishOn, {
    path: ["expiresOn"],
    message: "Ngày kết thúc không hợp lệ",
  });
export type AnnouncementInput = z.infer<typeof announcementSchema>;
export interface Announcement extends WorkforceRecord, AnnouncementInput {
  status: "draft" | "published" | "archived";
  contentVersion: number;
}
export interface AnnouncementReceipt extends Meta {
  announcementId: string;
  employeeId: string;
  contentVersion: number;
  acknowledgedAt: string;
}
export interface EmployeeImport extends Meta {
  actorId: string;
  createdIds: string[];
  updatedIds: string[];
  rowCount: number;
}
export interface WorkforcePerson {
  id: string;
  name: string;
  employeeCode: string;
  departmentId: string;
}
export interface Deadline {
  id: string;
  kind: string;
  title: string;
  employeeName: string;
  date: string;
  href: string;
  overdue: boolean;
}
export interface WorkforceWorkspace<T> {
  items: T[];
  people: WorkforcePerson[];
  canCreate: boolean;
}
export type TimeRequestView = TimeRequest & {
  employeeName: string;
  canReview: boolean;
  canCancel: boolean;
};
export type PayrollView = PayrollStatement & {
  employeeName: string;
  actions: string[];
};
export type PersonnelChangeView = PersonnelChange & {
  employeeName: string;
  actions: string[];
};
export type PersonnelDocumentView = Omit<PersonnelDocument, "files"> & {
  employeeName: string;
  canEdit: boolean;
  files: Omit<PersonnelDocument["files"][number], "objectKey">[];
};
export type AnnouncementView = Announcement & {
  canManage: boolean;
  acknowledged: boolean;
  acknowledgedCount?: number;
  audienceCount?: number;
};
export interface ImportRow {
  row: number;
  mode: "create" | "update";
  employeeId: string;
  input: EmployeeInput;
  errors: string[];
  changes: string[];
}
export interface ImportPreview {
  rows: ImportRow[];
  canCommit: boolean;
  fingerprint: string;
}
export const employeeImportSchema = z
  .object({
    rows: z
      .array(z.record(z.string(), z.string().max(500)))
      .min(1)
      .max(20),
    fingerprint: z.string().max(100).default(""),
  })
  .strict();
