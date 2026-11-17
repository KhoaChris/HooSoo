import { z } from "zod";
import type { Meta, WorkflowEvent } from "./index";

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
const link = z.union([
  z.literal(""),
  z
    .url()
    .max(1000)
    .refine((v) => new URL(v).protocol === "https:", "Chỉ dùng liên kết HTTPS"),
]);
export const serviceSections = ["assets", "training", "offboarding"] as const;
export type ServiceSection = (typeof serviceSections)[number];
export const serviceSectionLabels: Record<ServiceSection, string> = {
  assets: "Tài sản được cấp",
  training: "Đào tạo & phát triển",
  offboarding: "Nghỉ việc & bàn giao",
};
const common = {
  employeeId: id,
  title: text.max(150),
  notes: z.string().trim().max(2000).default(""),
  version: z.number().int().min(0).default(0),
};
export const serviceSetupSchema = z
  .discriminatedUnion("section", [
    z
      .object({
        ...common,
        section: z.literal("assets"),
        assetCode: z
          .string()
          .trim()
          .min(2)
          .max(50)
          .regex(/^[A-Za-z0-9_-]+$/)
          .transform((v) => v.toUpperCase()),
        startDate: day,
        endDate: z.union([day, z.literal("")]).default(""),
        sourceRequestId: z.union([id, z.literal("")]).default(""),
      })
      .strict(),
    z
      .object({
        ...common,
        section: z.literal("training"),
        provider: text.max(150),
        startDate: day,
        endDate: day,
        sourceRequestId: z.union([id, z.literal("")]).default(""),
      })
      .strict(),
    z
      .object({
        ...common,
        section: z.literal("offboarding"),
        endDate: day,
        notes: text,
      })
      .strict(),
  ])
  .refine(
    (v) =>
      v.section === "offboarding" || !v.endDate || v.endDate >= v.startDate,
    { path: ["endDate"], message: "Ngày kết thúc không hợp lệ" },
  );
export type ServiceSetup = z.infer<typeof serviceSetupSchema>;
export const serviceActions = [
  "acknowledge",
  "request-return",
  "receive-return",
  "submit-learning",
  "accept-learning",
  "revise-learning",
  "cancel",
  "complete",
] as const;
export type ServiceAction = (typeof serviceActions)[number];
export const serviceActionLabels: Record<ServiceAction, string> = {
  acknowledge: "Xác nhận đã nhận",
  "request-return": "Đề nghị thu hồi",
  "receive-return": "Xác nhận thu hồi",
  "submit-learning": "Gửi kết quả đào tạo",
  "accept-learning": "Công nhận hoàn thành",
  "revise-learning": "Yêu cầu bổ sung",
  cancel: "Hủy hồ sơ",
  complete: "Hoàn tất nghỉ việc",
};
export const serviceActionSchema = z
  .object({
    version: z.number().int().positive(),
    reason: text,
    documentUrl: link.default(""),
  })
  .strict();
export type ServiceActionInput = z.infer<typeof serviceActionSchema>;
export const serviceTaskOwners = {
  employee: "Nhân viên",
  manager: "Quản lý",
  hr: "Nhân sự",
} as const;
export const serviceTaskSchema = z
  .object({
    version: z.number().int().positive(),
    title: text.max(150),
    owner: z.enum(["employee", "manager", "hr"]),
  })
  .strict();
export const serviceTaskActionSchema = z
  .object({
    version: z.number().int().positive(),
    taskId: id,
    done: z.boolean(),
    reason: text,
  })
  .strict();
export interface ServiceTask {
  id: string;
  title: string;
  owner: keyof typeof serviceTaskOwners;
  completedAt: string;
  completedBy: string;
  note: string;
}
export type ServiceStatus =
  | "issued"
  | "in_use"
  | "return_requested"
  | "returned"
  | "in_progress"
  | "completion_requested"
  | "completed"
  | "cancelled";
export const serviceStatusLabels: Record<ServiceStatus, string> = {
  issued: "Chờ nhận tài sản",
  in_use: "Đang sử dụng",
  return_requested: "Chờ thu hồi",
  returned: "Đã thu hồi",
  in_progress: "Đang thực hiện",
  completion_requested: "Chờ công nhận",
  completed: "Đã hoàn tất",
  cancelled: "Đã hủy",
};
export interface ServiceRecord extends Meta {
  section: ServiceSection;
  employeeId: string;
  title: string;
  notes: string;
  version: number;
  status: ServiceStatus;
  startDate: string;
  endDate: string;
  sourceRequestId: string;
  assetCode: string;
  provider: string;
  documentUrl: string;
  outcome: string;
  tasks: ServiceTask[];
  history: WorkflowEvent[];
}
export interface ServiceView extends ServiceRecord {
  employeeName: string;
  employeeCode: string;
  canEdit: boolean;
  canAddTask: boolean;
  editableTasks: string[];
  actions: ServiceAction[];
  blockers: string[];
}
export interface ServiceWorkspace {
  items: ServiceView[];
  people: { id: string; name: string; employeeCode: string }[];
  requests: {
    id: string;
    employeeId: string;
    title: string;
    kind: string;
    resource: string;
  }[];
  canCreate: boolean;
}
export function serviceTone(status: ServiceStatus) {
  return ["returned", "completed"].includes(status)
    ? "success"
    : status === "cancelled"
      ? "danger"
      : ["issued", "return_requested", "completion_requested"].includes(status)
        ? "warning"
        : "info";
}
