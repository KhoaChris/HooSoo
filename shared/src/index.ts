import type {
  WorkRegistration,
  InternalRequest,
  RecruitmentJob,
  Candidate,
  CandidateFile,
} from "./hr";
import { z } from "zod";
export {
  queryCollections,
  mutationCollections,
  queryAffected,
} from "./data-dependencies";
import { roles, roleDefinitions } from "./access";
import type { Role } from "./access";
import type { WorkItem } from "./access/work";
export * from "./access";
export * from "./access/work";
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải có dạng YYYY-MM-DD")
  .refine(
    (v) =>
      !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    "Ngày không hợp lệ",
  );
const text = z.string().trim().min(1, "Thông tin bắt buộc").max(150);
export const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
export const employeeSchema = z
  .object({
    employeeCode: text
      .regex(/^[A-Za-z0-9-]+$/)
      .transform((v) => v.toUpperCase()),
    name: text,
    email: z.email(),
    phone: z.string().max(30).default(""),
    address: z.string().max(300).default(""),
    departmentId: idSchema,
    positionId: idSchema,
    managerId: z.union([idSchema, z.literal("")]).default(""),
    hireDate: dateSchema,
    status: z.enum(["probation", "active", "terminated"]).default("active"),
  })
  .strict();
export const profileSchema = z
  .object({ phone: z.string().max(30), address: z.string().max(300) })
  .strict();
export const catalogSchema = z
  .object({ name: text, description: z.string().max(500).default("") })
  .strict();
export const leaveTypeSchema = z
  .object({
    name: text,
    deductsBalance: z.boolean(),
    active: z.boolean().default(true),
  })
  .strict();
export const leaveSchema = z
  .object({
    leaveTypeId: idSchema,
    startDate: dateSchema,
    endDate: dateSchema,
    reason: z.string().trim().min(5, "Nhập ít nhất 5 ký tự").max(1000),
  })
  .strict();
export const reasonSchema = z
  .object({
    reason: z.string().trim().min(5, "Cần lý do ít nhất 5 ký tự").max(1000),
  })
  .strict();
export const userSchema = z
  .object({
    employeeId: idSchema,
    role: z.enum(roles),
    password: z.string().min(10, "Mật khẩu ít nhất 10 ký tự").max(100),
  })
  .strict();
export const clockSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const scheduleSchema = z
  .object({
    start: clockSchema,
    end: clockSchema,
    breakStart: clockSchema,
    breakEnd: clockSchema,
    lateGraceMinutes: z.number().int().min(0).max(60),
    workDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    holidays: z.array(dateSchema).max(100),
  })
  .strict()
  .refine(
    (v) =>
      v.start < v.end &&
      v.breakStart >= v.start &&
      v.breakEnd <= v.end &&
      v.breakStart < v.breakEnd,
    "Giờ nghỉ phải nằm trong ca làm việc ban ngày",
  );
export const settingsSchema = z
  .object({
    companyName: text.optional(),
    schedule: scheduleSchema.optional(),
    annualAllowance: z.number().int().min(0).max(365).optional(),
  })
  .strict();
export const balanceAdjustmentSchema = z
  .object({
    year: z.number().int().min(2020).max(2100),
    amount: z
      .number()
      .int()
      .min(-365)
      .max(365)
      .refine((n) => n !== 0),
    reason: z.string().trim().min(5).max(1000),
  })
  .strict();
export const attendanceAdjustmentSchema = z
  .object({
    checkIn: z.iso.datetime({ offset: true }),
    checkOut: z.union([z.iso.datetime({ offset: true }), z.null()]),
    reason: z.string().trim().min(5).max(1000),
  })
  .strict();
export const querySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().max(100).optional(),
    departmentId: idSchema.optional(),
    positionId: idSchema.optional(),
    employeeId: idSchema.optional(),
    status: z.string().max(30).optional(),
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
    year: z.coerce.number().int().min(2020).max(2100).optional(),
    mine: z.enum(["true", "false"]).optional(),
    approvals: z.enum(["true", "false"]).optional(),
    kind: z.enum(["employees", "attendance", "leave", "balances"]).optional(),
  })
  .strict()
  .refine(
    (v) =>
      !v.startDate ||
      !v.endDate ||
      (v.startDate <= v.endDate &&
        (Date.parse(v.endDate) - Date.parse(v.startDate)) / 86400000 <= 366),
    "Khoảng ngày tối đa 366 ngày và phải đúng thứ tự",
  );
export type Query = z.infer<typeof querySchema>;
export type EmployeeInput = z.infer<typeof employeeSchema>;
export interface Meta {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}
export interface Employee extends Meta, EmployeeInput {
  uid?: string;
}
export interface Catalog extends Meta {
  name: string;
  description: string;
  active: boolean;
}
export interface Membership extends Meta {
  employeeId: string;
  role: Role;
  active: boolean;
  email: string;
  orgId: string;
}
export type Schedule = z.infer<typeof scheduleSchema>;
export interface Settings extends Meta {
  companyName: string;
  schedule: Schedule;
  annualAllowance: number;
}
export interface Attendance extends Meta {
  employeeId: string;
  date: string;
  checkIn: string;
  checkOut: string | null;
  schedule: Schedule;
  adjustments: Array<{
    at: string;
    by: string;
    reason: string;
    before: { checkIn: string; checkOut: string | null };
    after: { checkIn: string; checkOut: string | null };
  }>;
}
export interface LeaveType extends Meta {
  name: string;
  deductsBalance: boolean;
  active: boolean;
}
export interface LeaveRequest extends Meta {
  employeeId: string;
  leaveTypeId: string;
  typeName: string;
  deductsBalance: boolean;
  startDate: string;
  endDate: string;
  days: number;
  workDates: string[];
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  history: Array<{ action: string; at: string; by: string; reason: string }>;
}
export interface Balance extends Meta {
  employeeId: string;
  year: number;
  allowance: number;
  used: number;
}
export interface BalanceTransaction extends Meta {
  employeeId: string;
  year: number;
  amount: number;
  kind: "allocation" | "adjustment" | "debit" | "refund";
  reason: string;
  requestId?: string;
  actorId: string;
}
export interface Audit extends Meta {
  actorId: string;
  action: string;
  targetId: string;
  reason: string;
  changes: Record<string, unknown>;
}
export interface AccountJob extends Meta {
  employeeId: string;
  uid: string;
  email: string;
  role: Role;
  status: "pending" | "complete" | "failed";
  actorId: string;
  error?: string;
}
export interface Receipt extends Meta {
  fingerprint: string;
  result: unknown;
  actorId: string;
}
export interface Tables {
  workItems: WorkItem;
  workRegistrations: WorkRegistration;
  internalRequests: InternalRequest;
  recruitmentJobs: RecruitmentJob;
  candidates: Candidate;
  candidateFiles: CandidateFile;
  employees: Employee;
  departments: Catalog;
  positions: Catalog;
  memberships: Membership;
  attendanceRecords: Attendance;
  leaveTypes: LeaveType;
  leaveRequests: LeaveRequest;
  leaveBalances: Balance;
  leaveBalanceTransactions: BalanceTransaction;
  auditLogs: Audit;
  settings: Settings;
  accountJobs: AccountJob;
  receipts: Receipt;
}
export type Table = keyof Tables;
export type State = { [K in Table]: Record<string, Tables[K]> };
export interface Actor {
  uid: string;
  employeeId: string;
  role: Role;
  orgId: string;
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export type EmployeeView = Omit<Employee, "phone" | "address" | "uid"> &
  Partial<Pick<Employee, "phone" | "address" | "uid">> & {
    accessRole?: Role | null;
    canEdit?: boolean;
  };
export interface AttendanceView extends Attendance {
  canAdjust?: boolean;
  employeeName: string;
  employeeCode: string;
  departmentId: string;
  status: string;
  late: boolean;
  presenceMinutes: number | null;
  paidMinutes: number | null;
  leaveConflict: boolean;
}
export interface LeaveView extends LeaveRequest {
  employeeName: string;
  employeeCode: string;
  departmentId: string;
  canApprove: boolean;
  canCancel: boolean;
}
export interface BalanceView extends Balance {
  canAdjust?: boolean;
  employeeName: string;
  pending: number;
  available: number;
  transactions: BalanceTransaction[];
}
export interface Me {
  actor: Actor;
  employee: EmployeeView;
  companyName: string;
}
export const labels: Record<string, string> = {
  ...Object.fromEntries(roles.map((r) => [r, roleDefinitions[r].label])),
  Admin: "Quản trị viên",
  HR: "Nhân sự",
  Manager: "Trưởng phòng",
  Employee: "Nhân viên",
  active: "Đang làm việc",
  probation: "Thử việc",
  terminated: "Đã nghỉ việc",
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  cancelled: "Đã hủy",
  on_time: "Đúng giờ",
  late: "Đi muộn",
  missing_checkout: "Thiếu giờ ra",
  working: "Đang làm việc",
  enabled: "Đang hoạt động",
  disabled: "Ngừng sử dụng",
};

export * from "./hr";
