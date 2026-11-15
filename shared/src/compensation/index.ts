import { z } from "zod";
import type { Meta, Role, WorkflowEvent } from "../index";

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
export const moneySchema = z
  .number({ error: "Nhập số tiền hợp lệ" })
  .int("Nhập số tiền nguyên")
  .min(0, "Số tiền không được âm")
  .max(10_000_000_000, "Số tiền vượt giới hạn");
export const allowancePresets = {
  meal: "Ăn trưa",
  transport: "Đi lại",
  phone: "Điện thoại",
  housing: "Nhà ở",
  responsibility: "Trách nhiệm",
  custom: "Phụ cấp khác",
} as const;
export const benefitPresets = {
  health: "Bảo hiểm sức khỏe",
  checkup: "Khám sức khỏe",
  training: "Đào tạo",
  leave: "Ngày nghỉ bổ sung",
  flexible: "Làm việc linh hoạt",
  equipment: "Thiết bị làm việc",
  wellbeing: "Chăm sóc đời sống",
  custom: "Phúc lợi khác",
} as const;
export const benefitSchema = z
  .object({
    id,
    kind: z.enum([
      "health",
      "checkup",
      "training",
      "leave",
      "flexible",
      "equipment",
      "wellbeing",
      "custom",
    ]),
    name: z.string().trim().min(2, "Nhập tên phúc lợi").max(100),
    detail: z.string().trim().max(600).default(""),
  })
  .strict();
const benefits = z
  .array(benefitSchema)
  .max(12)
  .refine(
    (v) => new Set(v.map((x) => x.id)).size === v.length,
    "Phúc lợi bị trùng",
  );
export const salaryPackageSchema = z
  .object({
    currency: z.literal("VND"),
    basis: z.literal("gross_monthly"),
    baseSalary: moneySchema.refine((v) => v > 0, "Lương cơ bản phải lớn hơn 0"),
    probationSalary: moneySchema.nullable(),
    allowances: z
      .array(
        z
          .object({
            id,
            kind: z.enum([
              "meal",
              "transport",
              "phone",
              "housing",
              "responsibility",
              "custom",
            ]),
            name: z.string().trim().min(2, "Nhập tên phụ cấp").max(100),
            amount: moneySchema.refine((v) => v > 0, "Phụ cấp phải lớn hơn 0"),
          })
          .strict(),
      )
      .max(10)
      .refine(
        (v) => new Set(v.map((x) => x.id)).size === v.length,
        "Phụ cấp bị trùng",
      ),
    benefits,
    bonusPolicy: z.string().trim().max(2000).default(""),
  })
  .strict()
  .refine(
    (v) =>
      v.probationSalary === null ||
      (v.probationSalary > 0 && v.probationSalary <= v.baseSalary),
    {
      path: ["probationSalary"],
      message: "Lương thử việc phải lớn hơn 0 và không vượt lương cơ bản",
    },
  );
export const recruitmentRewardSchema = z
  .object({
    mode: z.enum(["range", "negotiable"]),
    currency: z.literal("VND"),
    min: moneySchema.nullable(),
    max: moneySchema.nullable(),
    benefits,
  })
  .strict()
  .refine(
    (v) =>
      v.mode === "negotiable"
        ? v.min === null && v.max === null
        : v.min !== null && v.max !== null && v.min > 0 && v.max >= v.min,
    { path: ["min"], message: "Chọn khoảng lương hợp lệ" },
  );
export const compensationSetupSchema = z
  .object({
    employeeId: id,
    effectiveDate: day,
    package: salaryPackageSchema,
    reason: z.string().trim().min(3, "Nhập lý do điều chỉnh").max(1000),
    version: z.number().int().min(0),
  })
  .strict();
export const compensationActionSchema = z
  .object({
    version: z.number().int().positive(),
    reason: z.string().trim().min(3, "Nhập nội dung xác nhận").max(1000),
  })
  .strict();
export type SalaryPackage = z.infer<typeof salaryPackageSchema>;
export type RecruitmentReward = z.infer<typeof recruitmentRewardSchema>;
export type CompensationSetup = z.infer<typeof compensationSetupSchema>;
export type CompensationActionInput = z.infer<typeof compensationActionSchema>;
export interface CompensationRecord extends Meta, CompensationSetup {
  status: "draft" | "published" | "cancelled";
  sourceCandidateId: string;
  history: WorkflowEvent[];
}
export const compensationReaders: Role[] = [
  "Admin",
  "Director",
  "HR",
  "Manager",
];
export const compensationWriters: Role[] = ["Admin", "Director", "HR"];
export type CompensationPhase =
  "draft" | "current" | "scheduled" | "superseded" | "cancelled";
export interface CompensationView extends CompensationRecord {
  phase: CompensationPhase;
  canEdit: boolean;
  canPublish: boolean;
  canCancel: boolean;
}
export interface CompensationPerson {
  id: string;
  name: string;
  employeeCode: string;
  status: string;
  hireDate: string;
  canManage: boolean;
  records: CompensationView[];
}
export interface CompensationWorkspace {
  people: CompensationPerson[];
  asOf: string;
}
export function compensationPhase(
  record: CompensationRecord,
  records: readonly CompensationRecord[],
  today: string,
): CompensationPhase {
  if (record.status !== "published") return record.status;
  if (record.effectiveDate > today) return "scheduled";
  return records.some(
    (other) =>
      other.employeeId === record.employeeId &&
      other.status === "published" &&
      other.effectiveDate <= today &&
      other.effectiveDate > record.effectiveDate,
  )
    ? "superseded"
    : "current";
}
export function monthlyPackageTotal(value: SalaryPackage, probation = false) {
  return (
    (probation
      ? (value.probationSalary ?? value.baseSalary)
      : value.baseSalary) +
    value.allowances.reduce((sum, item) => sum + item.amount, 0)
  );
}
