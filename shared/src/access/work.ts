import { z } from "zod";
import {
  roleDefinitions,
  isSupervisorRole,
  type Role,
  type WorkArea,
} from "./index";
import type { Meta, WorkflowEvent } from "../index";
export const workKinds = [
  "milestone",
  "development",
  "test_plan",
  "test_run",
  "bug",
  "requirement",
  "design",
  "deployment",
  "incident",
] as const;
export type WorkKind = (typeof workKinds)[number];
export const workKindLabels: Record<WorkKind, string> = {
  milestone: "Mốc bàn giao",
  development: "Nhiệm vụ phát triển",
  test_plan: "Kế hoạch chất lượng",
  test_run: "Phiếu kiểm thử",
  bug: "Báo lỗi",
  requirement: "Yêu cầu nghiệp vụ",
  design: "Bàn giao thiết kế",
  deployment: "Kế hoạch triển khai",
  incident: "Sự cố vận hành",
};
export const kindAreas: Record<WorkKind, WorkArea> = {
  milestone: "delivery",
  development: "engineering",
  test_plan: "quality",
  test_run: "quality",
  bug: "quality",
  requirement: "analysis",
  design: "design",
  deployment: "operations",
  incident: "operations",
};
export const professionalRoles = (
  Object.keys(roleDefinitions) as Role[]
).filter((r) => roleDefinitions[r].areas.length > 0);
export function allowedWorkKinds(role: Role): WorkKind[] {
  return workKinds.filter(
    (k) =>
      roleDefinitions[role].areas.includes(kindAreas[k]) &&
      (isSupervisorRole(role) ||
        ((role !== "QC" || k !== "test_plan") &&
          (role !== "QA" || k !== "test_run"))),
  );
}
const id = z
  .string()
  .regex(/^[a-zA-Z0-9_-]{1,100}$/, "Vui lòng chọn thông tin hợp lệ");
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Vui lòng chọn ngày hợp lệ")
  .refine(
    (v) =>
      !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    "Ngày không hợp lệ",
  );
export const workItemSchema = z
  .object({
    kind: z.enum(workKinds, { error: "Vui lòng chọn loại công việc" }),
    title: z
      .string()
      .trim()
      .min(3, "Tên công việc cần ít nhất 3 ký tự")
      .max(150, "Tên công việc tối đa 150 ký tự"),
    project: z
      .string()
      .trim()
      .min(2, "Nhập tên dự án hoặc sản phẩm")
      .max(100, "Tên dự án tối đa 100 ký tự"),
    description: z
      .string()
      .trim()
      .min(5, "Mô tả yêu cầu ít nhất 5 ký tự")
      .max(4000, "Nội dung tối đa 4.000 ký tự"),
    criteria: z
      .string()
      .trim()
      .min(5, "Nêu tiêu chí hoàn thành ít nhất 5 ký tự")
      .max(3000, "Tiêu chí tối đa 3.000 ký tự"),
    departmentId: id,
    assigneeId: id,
    reviewerId: id,
    dueDate: date,
    priority: z.enum(["low", "normal", "high"]).default("normal"),
    version: z.number().int().min(0).default(0),
  })
  .strict();
export const workActionSchema = z
  .object({
    version: z.number().int().positive(),
    note: z
      .string()
      .trim()
      .min(5, "Nội dung xác nhận cần ít nhất 5 ký tự")
      .max(3000, "Nội dung tối đa 3.000 ký tự"),
    evidenceUrl: z
      .union(
        [
          z.literal(""),
          z
            .url()
            .refine(
              (v) => ["http:", "https:"].includes(new URL(v).protocol),
              "Chỉ dùng liên kết http/https",
            ),
        ],
        { error: "Nhập liên kết http/https hợp lệ hoặc để trống" },
      )
      .default(""),
  })
  .strict();
export type WorkItemInput = z.infer<typeof workItemSchema>;
export type WorkActionInput = z.infer<typeof workActionSchema>;
export const workStatusLabels = {
  open: "Chưa bắt đầu",
  in_progress: "Đang thực hiện",
  in_review: "Chờ rà soát",
  done: "Đã nghiệm thu",
  returned: "Cần bổ sung",
  cancelled: "Đã hủy",
};
export interface WorkItem extends Meta, WorkItemInput {
  status: keyof typeof workStatusLabels;
  outcome: string;
  evidenceUrl: string;
  history: WorkflowEvent[];
}
export interface WorkItemView extends WorkItem {
  assigneeName: string;
  reviewerName: string;
  canEdit: boolean;
  actions: WorkAction[];
}
export const workActions = [
  "start",
  "submit",
  "approve",
  "return",
  "cancel",
] as const;
export type WorkAction = (typeof workActions)[number];
export const workActionLabels: Record<WorkAction, string> = {
  start: "Bắt đầu xử lý",
  submit: "Gửi rà soát",
  approve: "Nghiệm thu",
  return: "Yêu cầu bổ sung",
  cancel: "Hủy công việc",
};
export interface ProfessionalWorkspace {
  items: WorkItemView[];
  kinds: WorkKind[];
  canAssign: boolean;
  people: { id: string; name: string; departmentId: string; role: Role }[];
  departments: { id: string; name: string }[];
}
