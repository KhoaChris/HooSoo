import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, X } from "lucide-react";
import { z } from "zod";
import { type LeaveView } from "@hoosoo/shared";
import { useApi, useAction } from "../../hooks/data";
import { dateText, timeText } from "../../utils/date-time";
import {
  Heading,
  Button,
  Loading,
  ErrorBox,
  Badge,
  Form,
  Modal,
} from "../../components/ui";

export function LeaveDetail() {
  const { requestId } = useParams();
  const q = useApi<LeaveView>("/leave-requests/" + requestId),
    action = useAction();
  const [decision, setDecision] = useState<
    "approve" | "reject" | "cancel" | null
  >(null);
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const r = q.data!,
    title = { approve: "Duyệt đơn", reject: "Từ chối đơn", cancel: "Hủy đơn" };
  return (
    <>
      <Heading
        title="Chi tiết yêu cầu nghỉ phép"
        description={r.employeeName + " · " + r.employeeCode}
        action={
          <Link className="button secondary" to="/leave/my">
            <ArrowLeft size={16} />
            Danh sách cá nhân
          </Link>
        }
      />
      <div className="detail-grid">
        <section className="panel">
          <div className="section-heading">
            <h2>{r.typeName}</h2>
            <Badge value={r.status} />
          </div>
          <dl className="details">
            <dt>Từ ngày</dt>
            <dd>{dateText(r.startDate)}</dd>
            <dt>Đến ngày</dt>
            <dd>{dateText(r.endDate)}</dd>
            <dt>Số ngày làm việc</dt>
            <dd>{r.days} ngày</dd>
            <dt>Trừ số dư phép</dt>
            <dd>{r.deductsBalance ? "Có" : "Không"}</dd>
            <dt>Lý do</dt>
            <dd className="whitespace-pre-wrap">{r.reason}</dd>
          </dl>
          <div className="row-actions">
            {r.canApprove && (
              <>
                <Button onClick={() => setDecision("approve")}>
                  <Check size={16} />
                  Duyệt đơn
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setDecision("reject")}
                >
                  <X size={16} />
                  Từ chối
                </Button>
              </>
            )}
            {r.canCancel && (
              <Button variant="danger" onClick={() => setDecision("cancel")}>
                Hủy đơn
              </Button>
            )}
          </div>
        </section>
        <section className="panel">
          <h2>Tiến trình xử lý</h2>
          <ul className="timeline">
            {r.history.map((h, i) => (
              <li key={i}>
                <span className="timeline-dot" />
                <strong>
                  {{
                    created: "Gửi yêu cầu",
                    approve: "Đã duyệt",
                    reject: "Đã từ chối",
                    cancel: "Đã hủy",
                  }[h.action] || h.action}
                </strong>
                <small>
                  {dateText(h.at)} · {timeText(h.at)}
                </small>
                {h.reason && <p>{h.reason}</p>}
              </li>
            ))}
          </ul>
          <p className="muted-note">
            Ngày tính phép được lưu tại thời điểm gửi đơn. Thay đổi chính sách
            sau đó không sửa lịch sử đơn.
          </p>
        </section>
      </div>
      {decision && (
        <Modal title={title[decision]} onClose={() => setDecision(null)}>
          <p>
            {decision === "approve"
              ? `Xác nhận duyệt ${r.days} ngày nghỉ cho ${r.employeeName}?`
              : decision === "cancel" && r.status === "approved"
                ? "Đơn đã được duyệt. Số ngày phép bị trừ sẽ được hoàn đúng một lần."
                : "Xác nhận xử lý yêu cầu này."}
          </p>
          <Form
            schema={z.object({
              reason: z
                .string()
                .trim()
                .min(
                  decision === "reject" ||
                    (decision === "cancel" && r.status === "approved")
                    ? 5
                    : 0,
                )
                .max(1000),
            })}
            fields={[
              {
                name: "reason",
                label:
                  decision === "approve" ? "Ghi chú (không bắt buộc)" : "Lý do",
                type: "textarea",
              },
            ]}
            defaults={{ reason: "" }}
            onSubmit={async (body) => {
              await action.mutateAsync({
                path: "/leave-requests/" + r.id + "/" + decision,
                body,
              });
              setDecision(null);
            }}
            onCancel={() => setDecision(null)}
            submitLabel={title[decision]}
          />
        </Modal>
      )}
    </>
  );
}
