import {
  contractSchema,
  probationSchema,
  onboardingSchema,
  onboardingTaskSchema,
  probationReviewSchema,
  employmentActionSchema,
  contractTypes,
  competencyLabels,
  ratingLabels,
  employmentActionLabels,
  onboardingOwners,
  type EmploymentSection,
  type EmploymentView,
  type EmploymentWorkspace,
  type EmploymentAction,
} from "@hoosoo/shared";
import { Form, Modal, type FormField } from "../../components/ui";
import { t, useLocale } from "../../i18n";
import { useAction } from "../../hooks/data";
import { today } from "../workflows/workflow-ui";
import { EmploymentChoice } from "./employment-choice";
import { sectionLabels } from "./employment-model";
export function EmploymentEditor({
  section,
  workspace,
  item,
  onClose,
}: {
  section: EmploymentSection;
  workspace: EmploymentWorkspace;
  item?: EmploymentView;
  onClose: () => void;
}) {
  useLocale();
  const save = useAction();
  const people = workspace.people.filter(
    (p) => section !== "probations" || p.status === "probation",
  );
  const fields: FormField[] = [
    {
      name: "employeeId",
      label: t("Nhân viên"),
      type: "select",
      required: true,
      span: "full",
      disabled: !!item,
      options: people.map((p) => ({
        value: p.id,
        label: `${p.name} · ${p.employeeCode}`,
      })),
    },
    ...(section === "contracts"
      ? ([
          {
            name: "title",
            label: t("Tên hợp đồng"),
            span: "full",
            required: true,
          },
          {
            name: "kind",
            label: t("Loại hợp đồng"),
            type: "select",
            span: "full",
            options: Object.entries(contractTypes).map(([value, label]) => ({
              value,
              label: t(label),
            })),
          },
        ] as FormField[])
      : []),
    {
      name: "startDate",
      label: t(section === "onboarding" ? "Ngày tiếp nhận" : "Ngày bắt đầu"),
      type: "date",
      required: true,
    },
    ...(section !== "onboarding"
      ? ([
          {
            name: "endDate",
            label: t("Ngày kết thúc"),
            type: "date",
            required: section === "probations",
            ...(section === "contracts"
              ? { hint: t("Để trống với hợp đồng không thời hạn.") }
              : {}),
          },
        ] as FormField[])
      : []),
    ...(section === "contracts"
      ? ([
          {
            name: "documentUrl",
            label: t("Liên kết tài liệu hợp đồng"),
            span: "full",
            placeholder: "https://…",
          },
          {
            name: "notes",
            label: t("Điều khoản & ghi nhận"),
            type: "textarea",
            span: "full",
          },
        ] as FormField[])
      : section === "probations"
        ? ([
            {
              name: "objectives",
              label: t("Mục tiêu thử việc"),
              type: "textarea",
              span: "full",
              required: true,
            },
          ] as FormField[])
        : []),
  ];
  const defaults = item
    ? Object.fromEntries(
        [...fields.map((f) => f.name), "version"].map((k) => [
          k,
          (item as unknown as Record<string, unknown>)[k],
        ]),
      )
    : {
        employeeId: people[0]?.id ?? "",
        startDate: today(),
        ...(section !== "onboarding" ? { version: 0, endDate: "" } : {}),
        ...(section === "contracts"
          ? { title: "", kind: "fixed_term", documentUrl: "", notes: "" }
          : section === "probations"
            ? { objectives: "" }
            : {}),
      };
  return (
    <Modal
      title={`${t(item ? "Chỉnh sửa" : "Tạo mới")} · ${t(sectionLabels[section])}`}
      size="wide"
      onClose={onClose}
    >
      <Form
        key={item?.id ?? "new"}
        columns={2}
        schema={
          section === "contracts"
            ? contractSchema
            : section === "probations"
              ? probationSchema
              : onboardingSchema
        }
        fields={fields}
        defaults={defaults}
        onCancel={onClose}
        onSubmit={async (body) => {
          await save.mutateAsync({
            path: `/employment/${section}${item ? "/" + item.id : ""}`,
            method: item ? "PATCH" : "POST",
            body,
          });
          onClose();
        }}
      />
    </Modal>
  );
}
export function EmploymentDecision({
  section,
  item,
  action,
  onClose,
}: {
  section: EmploymentSection;
  item: EmploymentView;
  action: EmploymentAction | "add-task";
  onClose: () => void;
}) {
  useLocale();
  const save = useAction();
  let fields: FormField[],
    defaults: Record<string, unknown> = { version: item.version },
    schema;
  if (action === "review") {
    schema = probationReviewSchema;
    fields = Object.entries(competencyLabels).map(([name, label]) => ({
      name,
      label: t(label),
      required: true,
      span: "full",
      render: (props) => (
        <EmploymentChoice
          {...props}
          options={Object.entries(ratingLabels).map(([value, label]) => ({
            value,
            label: t(label),
          }))}
        />
      ),
    }));
    fields.push(
      {
        name: "strengths",
        label: t("Điểm mạnh & kết quả"),
        type: "textarea",
        required: true,
        span: "full",
      },
      {
        name: "improvements",
        label: t("Nội dung cần phát triển"),
        type: "textarea",
        required: true,
        span: "full",
      },
      {
        name: "recommendation",
        label: t("Đề xuất của quản lý"),
        span: "full",
        required: true,
        render: (props) => (
          <EmploymentChoice
            {...props}
            options={[
              { value: "confirm", label: t("Xác nhận chính thức") },
              { value: "extend", label: t("Gia hạn thử việc") },
              { value: "decline", label: t("Không đạt thử việc") },
            ]}
          />
        ),
      },
    );
    defaults = { ...defaults, strengths: "", improvements: "" };
  } else if (action === "add-task") {
    schema = onboardingTaskSchema;
    fields = [
      {
        name: "title",
        label: t("Nội dung tiếp nhận"),
        required: true,
        span: "full",
      },
      {
        name: "owner",
        label: t("Người phụ trách"),
        type: "select",
        options: Object.entries(onboardingOwners).map(([value, label]) => ({
          value,
          label: t(label),
        })),
      },
      {
        name: "dueDate",
        label: t("Hạn hoàn thành"),
        type: "date",
        required: true,
      },
    ];
    defaults = { ...defaults, title: "", owner: "employee", dueDate: today() };
  } else {
    schema = employmentActionSchema;
    fields = [
      {
        name: "reason",
        label: t(
          action === "self-review"
            ? "Kết quả & tự đánh giá"
            : action === "acknowledge"
              ? "Nội dung xác nhận"
              : "Nội dung quyết định",
        ),
        type: "textarea",
        required: true,
        span: "full",
      },
      ...(action === "extend"
        ? [
            {
              name: "endDate",
              label: t("Ngày kết thúc mới"),
              type: "date",
              required: true,
            } as FormField,
          ]
        : []),
    ];
    defaults = {
      ...defaults,
      reason:
        action === "acknowledge"
          ? t("Tôi xác nhận đã nhận tài liệu hợp đồng.")
          : "",
      endDate: "",
    };
  }
  const title = t(
    action === "add-task"
      ? "Thêm mục tiếp nhận"
      : employmentActionLabels[action],
  );
  return (
    <Modal
      title={title}
      description={item.employeeName}
      size={action === "review" ? "wide" : "medium"}
      onClose={onClose}
    >
      <Form
        schema={schema}
        fields={fields}
        defaults={defaults}
        columns={action === "review" || action === "add-task" ? 2 : 1}
        submitLabel={title}
        submitTone={
          ["decline", "cancel", "end", "return"].includes(action)
            ? "danger"
            : ["confirm", "complete", "acknowledge"].includes(action)
              ? "success"
              : undefined
        }
        onCancel={onClose}
        onSubmit={async (body) => {
          await save.mutateAsync({
            path: `/employment/${section}/${item.id}/${action === "add-task" ? "tasks" : action}`,
            body,
          });
          onClose();
        }}
      />
    </Modal>
  );
}
