import { StableText } from "../../i18n/stable-text";
import { t, useLocale } from "../../i18n";
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
  useLocale();
  const { requestId } = useParams();
  const q = useApi<LeaveView>("/leave-requests/" + requestId),
    action = useAction();
  const [decision, setDecision] = useState<
    "approve" | "reject" | "cancel" | null
  >(null);
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const r = q.data!,
    title = {
      approve: t("Duyệt đơn"),
      reject: t("Từ chối đơn"),
      cancel: t("Hủy đơn"),
    };
  return (
    <>
      <Heading
        title={t("Chi tiết yêu cầu nghỉ phép")}
        description={r.employeeName + " · " + r.employeeCode}
        action={
          <Link className="button secondary" to="/leave/my">
            <ArrowLeft size={16} />
            <StableText>{t("Danh sách cá nhân")}</StableText>
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
            <dt>
              <StableText>{t("Từ ngày")}</StableText>
            </dt>
            <dd>{dateText(r.startDate)}</dd>
            <dt>
              <StableText>{t("Đến ngày")}</StableText>
            </dt>
            <dd>{dateText(r.endDate)}</dd>
            <dt>
              <StableText>{t("Số ngày làm việc")}</StableText>
            </dt>
            <dd>
              {r.days} <StableText>{t("ngày")}</StableText>
            </dd>
            <dt>
              <StableText>{t("Trừ số dư phép")}</StableText>
            </dt>
            <dd>
              <StableText>{r.deductsBalance ? t("Có") : t("Không")}</StableText>
            </dd>
            <dt>
              <StableText>{t("Lý do")}</StableText>
            </dt>
            <dd className="whitespace-pre-wrap">{r.reason}</dd>
          </dl>
          <div className="row-actions">
            {r.canApprove && (
              <>
                <Button tone="success" onClick={() => setDecision("approve")}>
                  <Check size={16} />
                  {t("Duyệt đơn")}
                </Button>
                <Button
                  variant="secondary"
                  tone="danger"
                  onClick={() => setDecision("reject")}
                >
                  <X size={16} />
                  {t("Từ chối")}
                </Button>
              </>
            )}
            {r.canCancel && (
              <Button variant="danger" onClick={() => setDecision("cancel")}>
                {t("Hủy đơn")}
              </Button>
            )}
          </div>
        </section>
        <section className="panel">
          <h2>
            <StableText>{t("Tiến trình xử lý")}</StableText>
          </h2>
          <ul className="timeline">
            {r.history.map((h, i) => (
              <li key={i}>
                <span className="timeline-dot" />
                <strong>
                  {{
                    created: t("Gửi yêu cầu"),
                    approve: t("Đã duyệt"),
                    reject: t("Đã từ chối"),
                    cancel: t("Đã hủy"),
                  }[h.action] || h.action}
                </strong>
                <small>
                  {dateText(h.at)} · {timeText(h.at)}
                </small>
                {h.reason && <p>{h.reason}</p>}
              </li>
            ))}
          </ul>
        </section>
      </div>
      {decision && (
        <Modal title={title[decision]} onClose={() => setDecision(null)}>
          <p>
            <StableText>
              {decision === "approve"
                ? t("Xác nhận duyệt {0} ngày nghỉ cho {1}?", [
                    r.days,
                    r.employeeName,
                  ])
                : decision === "cancel" && r.status === "approved"
                  ? t("Hủy đơn sẽ hoàn lại số ngày phép đã trừ.")
                  : t("Xác nhận xử lý yêu cầu này.")}
            </StableText>
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
                  decision === "approve"
                    ? t("Ghi chú (không bắt buộc)")
                    : t("Lý do"),
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
            submitTone={decision === "approve" ? "success" : "danger"}
          />
        </Modal>
      )}
    </>
  );
}
