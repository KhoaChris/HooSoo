import { Check, Clock3, ArrowRight, FileCheck2 } from "lucide-react";
import {
  reviewSchema,
  workflowLabels,
  type WorkflowEvent,
  type ApprovalStatus,
} from "@hoosoo/shared";
import { Form, Modal } from "../../components/ui";
import { useAction } from "../../hooks/data";
export const dayLabel = (date: string) =>
  new Date(date + "T12:00:00+07:00").toLocaleDateString("vi-VN", {
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
  return (
    <span className={`workflow-status status-${status}`}>
      <span />
      {workflowLabels[status] ?? status}
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
  const final = status === "approved";
  return (
    <div className="approval-steps" aria-label="Quy trình phê duyệt">
      <span>
        <Check size={16} />
        Đã gửi
      </span>
      <ArrowRight size={14} />
      <span className={status === "pending_manager" ? "current" : ""}>
        <Clock3 size={16} />
        {managerName}
      </span>
      <ArrowRight size={14} />
      <span className={status === "pending_hr" ? "current" : ""}>
        <FileCheck2 size={16} />
        {final ? "Đã xác nhận" : "HR / Admin xác nhận"}
      </span>
    </div>
  );
}
export function WorkflowHistory({ history }: { history: WorkflowEvent[] }) {
  return (
    <ol className="workflow-history">
      {history.map((h, i) => (
        <li key={`${h.at}-${i}`}>
          <span className="history-dot" />
          <div>
            <strong>{workflowLabels[h.action] ?? "Cập nhật hồ sơ"}</strong>
            <small>
              {h.name} ·{" "}
              {new Date(h.at).toLocaleString("vi-VN", {
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
  const save = useAction();
  return (
    <Modal
      title={
        action === "approve"
          ? "Xác nhận phê duyệt"
          : action === "reject"
            ? "Từ chối đề nghị"
            : "Rút đề nghị"
      }
      description={title}
      onClose={onClose}
      icon={<FileCheck2 size={22} />}
    >
      <Form
        schema={reviewSchema}
        defaults={{ version, reason: "" }}
        fields={[
          {
            name: "reason",
            label:
              action === "approve" ? "Nội dung xác nhận / phản hồi" : "Lý do",
            type: "textarea",
            required: true,
            hint: "Nội dung này được lưu trong lịch sử và hiển thị cho người gửi.",
          },
        ]}
        submitLabel={
          action === "approve"
            ? "Xác nhận duyệt"
            : action === "reject"
              ? "Từ chối đề nghị"
              : "Rút đề nghị"
        }
        onSubmit={async (body) => {
          await save.mutateAsync({ path: `${path}/${action}`, body });
          onClose();
        }}
      />
    </Modal>
  );
}
