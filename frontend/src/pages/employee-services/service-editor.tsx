import { useState } from "react";
import { Package, GraduationCap, ClipboardCheck } from "lucide-react";
import {
  serviceSetupSchema,
  serviceActionSchema,
  serviceTaskSchema,
  serviceTaskActionSchema,
  serviceActionLabels,
  serviceTaskOwners,
  type ServiceSection,
  type ServiceView,
  type ServiceWorkspace,
  type ServiceAction,
  type ServiceTask,
} from "@hoosoo/shared";
import { Form, Modal, Select, type FormField } from "../../components/ui";
import { useAction } from "../../hooks/data";
import { t, useLocale } from "../../i18n";
import { today } from "../workflows/workflow-ui";
import { serviceDefaults } from "./service-model";
export const serviceIcons = {
  assets: Package,
  training: GraduationCap,
  offboarding: ClipboardCheck,
};
export const serviceCreateLabels = {
  assets: "Cấp phát tài sản",
  training: "Ghi danh đào tạo",
  offboarding: "Lập hồ sơ bàn giao",
};
export function ServiceEditor({
  section,
  item,
  workspace,
  onClose,
}: {
  section: ServiceSection;
  item?: ServiceView;
  workspace: ServiceWorkspace;
  onClose: () => void;
}) {
  useLocale();
  const save = useAction(),
    [source, setSource] = useState(item?.sourceRequestId ?? "");
  const request = workspace.requests.find((r) => r.id === source),
    defaults = serviceDefaults(section, today(), item, request),
    Icon = serviceIcons[section];
  const fields: FormField[] = [
    {
      name: "employeeId",
      label: "Nhân viên",
      type: "select",
      required: true,
      disabled: !!item || !!request,
      options: [
        { value: "", label: t("Chọn nhân viên"), disabled: true },
        ...workspace.people.map((p) => ({
          value: p.id,
          label: `${p.name} · ${p.employeeCode}`,
        })),
      ],
    },
    {
      name: "title",
      label:
        section === "assets"
          ? "Tên tài sản"
          : section === "training"
            ? "Khóa đào tạo"
            : "Tên hồ sơ bàn giao",
      required: true,
    },
  ];
  if (section === "assets")
    fields.push(
      {
        name: "assetCode",
        label: "Mã tài sản",
        required: true,
        disabled: !!item,
      },
      {
        name: "startDate",
        label: "Ngày cấp phát",
        type: "date",
        required: true,
      },
      { name: "endDate", label: "Hạn thu hồi", type: "date" },
    );
  if (section === "training")
    fields.push(
      {
        name: "provider",
        label: "Đơn vị đào tạo",
        required: true,
        span: "full",
      },
      { name: "startDate", label: "Bắt đầu", type: "date", required: true },
      { name: "endDate", label: "Kết thúc", type: "date", required: true },
    );
  if (section === "offboarding")
    fields.push({
      name: "endDate",
      label: "Ngày làm việc cuối",
      type: "date",
      required: true,
      span: "full",
    });
  fields.push({
    name: "notes",
    label:
      section === "offboarding"
        ? "Lý do nghỉ việc"
        : "Nội dung bàn giao / yêu cầu",
    type: "textarea",
    required: section === "offboarding",
    span: "full",
  });
  return (
    <Modal
      title={t(item ? "Chỉnh sửa hồ sơ" : serviceCreateLabels[section])}
      icon={<Icon size={22} />}
      size="wide"
      onClose={onClose}
    >
      {section !== "offboarding" && !item && (
        <label className="service-source">
          <span>{t("Từ phiếu đã duyệt")}</span>
          <Select
            value={source}
            onValueChange={setSource}
            options={[
              { value: "", label: t("Tạo trực tiếp") },
              ...workspace.requests.map((r) => ({
                value: r.id,
                label: `${workspace.people.find((p) => p.id === r.employeeId)?.name ?? ""} · ${r.title}`,
              })),
            ]}
          />
        </label>
      )}
      <Form
        key={source}
        schema={serviceSetupSchema}
        defaults={defaults}
        columns={2}
        fields={fields}
        onCancel={onClose}
        onSubmit={async (body) => {
          await save.mutateAsync({
            path: `/employee-services${item ? `/${item.id}` : ""}`,
            method: item ? "PATCH" : "POST",
            body,
          });
          onClose();
        }}
      />
    </Modal>
  );
}
export type ServiceDecision = {
  item: ServiceView;
  action: ServiceAction | "add-task" | "task";
  task?: ServiceTask;
};
export function ServiceDecisionDialog({
  decision,
  onClose,
}: {
  decision: ServiceDecision;
  onClose: () => void;
}) {
  useLocale();
  const { item, action, task } = decision,
    save = useAction();
  const add = action === "add-task",
    toggle = action === "task",
    submit = action === "submit-learning";
  const title = add
    ? "Thêm mục bàn giao"
    : toggle
      ? task?.completedAt
        ? "Mở lại mục bàn giao"
        : "Xác nhận bàn giao"
      : serviceActionLabels[action as ServiceAction];
  const fields: FormField[] = add
    ? [
        { name: "title", label: "Nội dung bàn giao", required: true },
        {
          name: "owner",
          label: "Người phụ trách",
          type: "select",
          required: true,
          options: Object.entries(serviceTaskOwners).map(([value, label]) => ({
            value,
            label: t(label),
          })),
        },
      ]
    : [
        {
          name: "reason",
          label: submit ? "Kết quả & nội dung đã học" : "Nhận xét / lý do",
          type: "textarea",
          required: true,
        },
      ];
  if (submit)
    fields.push({
      name: "documentUrl",
      label: "Liên kết chứng nhận (HTTPS)",
      placeholder: "https://",
    });
  return (
    <Modal
      title={t(title)}
      description={task?.title ?? item.title}
      onClose={onClose}
    >
      {action === "complete" && (
        <p className="service-warning">
          {t(
            "Hoàn tất sẽ kết thúc hồ sơ làm việc, hợp đồng đang hiệu lực và quyền truy cập của nhân viên.",
          )}
        </p>
      )}
      <Form
        schema={
          add
            ? serviceTaskSchema
            : toggle
              ? serviceTaskActionSchema
              : serviceActionSchema
        }
        defaults={
          add
            ? { version: item.version, title: "", owner: "hr" }
            : toggle
              ? {
                  version: item.version,
                  taskId: task!.id,
                  done: !task!.completedAt,
                  reason: "",
                }
              : {
                  version: item.version,
                  reason: "",
                  documentUrl: submit ? item.documentUrl : "",
                }
        }
        fields={fields}
        submitLabel={t(title)}
        submitTone={
          action === "cancel" || action === "complete"
            ? "danger"
            : action === "accept-learning" || action === "receive-return"
              ? "success"
              : undefined
        }
        onCancel={onClose}
        onSubmit={async (body) => {
          await save.mutateAsync({
            path: `/employee-services/${item.id}/${add ? "tasks" : toggle ? "task" : action}`,
            body,
          });
          onClose();
        }}
      />
    </Modal>
  );
}
