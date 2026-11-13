import { StableText } from "../../i18n/stable-text";
import { t, useLocale, intlLocale } from "../../i18n";
import { Check, Clock3, ArrowRight, FileCheck2 } from "lucide-react";
import {
  reviewSchema,
  workflowLabels,
  type WorkflowEvent,
  type ApprovalStatus,
} from "@hoosoo/shared";
import { Form, Modal } from "../../components/ui";
import { useAction } from "../../hooks/data";
import { statusTone } from "../../components/ui/status-tone";
export const dayLabel = (date: string) =>
  new Date(date + "T12:00:00+07:00").toLocaleDateString(intlLocale(), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function WorkflowBadge({ status }: { status: string }) {
  useLocale();
  return (
    <span
      className={`workflow-status status-tone status-${status}`}
      data-tone={statusTone(status)}
    >
      <span />
      <StableText>{t(workflowLabels[status]) || status}</StableText>
    </span>
  );
}
export function ApprovalSteps({
  status,
  managerName,
}: {
  status: ApprovalStatus;
  managerName: string;
}) {
  useLocale();
  const final = status === "approved";
  return (
    <div className="approval-steps" aria-label={t("Quy trình phê duyệt")}>
      <span>
        <Check size={16} />
        {t("Đã gửi")}
      </span>
      <ArrowRight size={14} />
      <span className={status === "pending_manager" ? "current" : ""}>
        <Clock3 size={16} />
        {managerName}
      </span>
      <ArrowRight size={14} />
      <span className={status === "pending_hr" ? "current" : ""}>
        <FileCheck2 size={16} />
        {final ? t("Đã xác nhận") : t("HR / Admin xác nhận")}
      </span>
    </div>
  );
}
export function WorkflowHistory({ history }: { history: WorkflowEvent[] }) {
  useLocale();
  return (
    <ol className="workflow-history">
      {history.map((h, i) => (
        <li key={`${h.at}-${i}`}>
          <span className="history-dot" />
          <div>
            <strong>
              {t(workflowLabels[h.action]) ?? t("Cập nhật hồ sơ")}
            </strong>
            <small>
              {h.name} ·{" "}
              {new Date(h.at).toLocaleString(intlLocale(), {
                timeZone: "Asia/Ho_Chi_Minh",
              })}
            </small>
            {h.reason && <p>{h.reason}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
export function ReviewDialog({
  path,
  version,
  action,
  title,
  onClose,
}: {
  path: string;
  version: number;
  action: "approve" | "reject" | "cancel";
  title: string;
  onClose: () => void;
}) {
  useLocale();
  const save = useAction();
  return (
    <Modal
      title={
        action === "approve"
          ? t("Xác nhận phê duyệt")
          : action === "reject"
            ? t("Từ chối đề nghị")
            : t("Rút đề nghị")
      }
      description={title}
      onClose={onClose}
      icon={<FileCheck2 size={22} />}
    >
      <Form
        schema={reviewSchema}
        submitTone={action === "approve" ? "success" : "danger"}
        defaults={{ version, reason: "" }}
        fields={[
          {
            name: "reason",
            label:
              action === "approve"
                ? t("Nội dung xác nhận / phản hồi")
                : t("Lý do"),
            type: "textarea",
            required: true,
          },
        ]}
        submitLabel={
          action === "approve"
            ? t("Xác nhận duyệt")
            : action === "reject"
              ? t("Từ chối đề nghị")
              : t("Rút đề nghị")
        }
        onSubmit={async (body) => {
          await save.mutateAsync({ path: `${path}/${action}`, body });
          onClose();
        }}
      />
    </Modal>
  );
}
