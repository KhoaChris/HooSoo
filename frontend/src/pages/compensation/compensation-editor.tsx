import { WalletCards } from "lucide-react";
import {
  compensationSetupSchema,
  compensationActionSchema,
  type CompensationPerson,
  type CompensationView,
  type SalaryPackage,
} from "@hoosoo/shared";
import { Form, Modal } from "../../components/ui";
import { useAction } from "../../hooks/data";
import { t, useLocale } from "../../i18n";
import { today, dayLabel } from "../workflows/workflow-ui";
import { SalaryPackageEditor } from "./reward-fields";
import { emptySalaryPackage, nextCompensationDate } from "./compensation-model";
import { PackageSummary } from "./compensation-detail";
export function CompensationEditor({
  person,
  record,
  onClose,
}: {
  person: CompensationPerson;
  record?: CompensationView;
  onClose: () => void;
}) {
  useLocale();
  const save = useAction();
  const current = person.records.find((r) => r.phase === "current");
  return (
    <Modal
      title={t(
        record ? "Chỉnh sửa chế độ đãi ngộ" : "Thiết lập lương & phúc lợi",
      )}
      description={`${person.name} · ${person.employeeCode}`}
      icon={<WalletCards size={22} />}
      onClose={onClose}
      size="wide"
      className="compensation-dialog"
    >
      <Form
        schema={compensationSetupSchema}
        columns={2}
        defaults={{
          employeeId: person.id,
          effectiveDate:
            record?.effectiveDate ?? nextCompensationDate(person, today()),
          package: structuredClone(
            record?.package ?? current?.package ?? emptySalaryPackage(),
          ),
          reason: record?.reason ?? "",
          version: record?.version ?? 0,
        }}
        fields={[
          {
            name: "effectiveDate",
            label: t("Ngày hiệu lực"),
            type: "date",
            required: true,
            min: person.hireDate,
          },
          {
            name: "reason",
            label: t("Lý do điều chỉnh"),
            required: true,
            placeholder: t(
              "Nhận việc, điều chỉnh định kỳ hoặc thay đổi vai trò",
            ),
          },
          {
            name: "package",
            label: t("Chế độ đãi ngộ"),
            span: "full",
            required: true,
            render: (p) => (
              <SalaryPackageEditor
                id={p.id}
                labelledBy={p.labelId}
                describedBy={p.describedBy}
                value={p.value as SalaryPackage}
                onChange={p.onChange}
                disabled={p.disabled}
                invalid={p.invalid}
              />
            ),
          },
        ]}
        onCancel={onClose}
        submitLabel={t("Lưu bản nháp")}
        onSubmit={async (body) => {
          await save.mutateAsync({
            path: record
              ? `/compensation/records/${record.id}`
              : "/compensation/records",
            method: record ? "PATCH" : "POST",
            body,
          });
          onClose();
        }}
      />
    </Modal>
  );
}
export function CompensationDecision({
  person,
  record,
  action,
  onClose,
}: {
  person: CompensationPerson;
  record: CompensationView;
  action: "publish" | "cancel";
  onClose: () => void;
}) {
  useLocale();
  const save = useAction(),
    title = t(action === "publish" ? "Công bố mức lương" : "Hủy điều chỉnh");
  return (
    <Modal
      title={title}
      description={`${person.name} · ${dayLabel(record.effectiveDate)}`}
      size="wide"
      onClose={onClose}
      className="compensation-dialog"
    >
      {action === "publish" && <PackageSummary value={record.package} />}
      <Form
        schema={compensationActionSchema}
        defaults={{ version: record.version, reason: "" }}
        fields={[
          {
            name: "reason",
            label: t("Nội dung xác nhận"),
            type: "textarea",
            required: true,
          },
        ]}
        submitLabel={title}
        submitTone={action === "publish" ? "success" : "danger"}
        onCancel={onClose}
        onSubmit={async (body) => {
          await save.mutateAsync({
            path: `/compensation/records/${record.id}/${action}`,
            body,
          });
          onClose();
        }}
      />
    </Modal>
  );
}
