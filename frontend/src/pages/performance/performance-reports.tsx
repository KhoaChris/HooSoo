import { reviewTitle } from "./performance-planning";
import { useState } from "react";
import { FileCheck2, Send, ArrowUpRight } from "lucide-react";
import {
  performanceReportSchema,
  performanceActionSchema,
  performanceReportLabels,
  type PerformanceWorkspace,
  type PerformanceView,
  type PerformanceReportView,
} from "@hoosoo/shared";
import { Button, DataTable, Form, Modal } from "../../components/ui";
import { useAction } from "../../hooks/data";
import { t, useLocale, intlLocale } from "../../i18n";

export function PerformanceReportEditor({
  workspace,
  items,
  onClose,
  onSaved,
}: {
  workspace: PerformanceWorkspace;
  items: PerformanceView[];
  onClose: () => void;
  onSaved: () => void;
}) {
  useLocale();
  const save = useAction();
  const recipients = (workspace.reportRecipients ?? []).filter((r) =>
    items.every(
      (i) =>
        r.employeeIds.includes(i.employeeId) &&
        (!i.requiredReviewerId || i.requiredReviewerId === r.id),
    ),
  );
  return (
    <Modal
      title={t("Gửi báo cáo đánh giá")}
      description={t("{0} đánh giá được chọn", [items.length])}
      icon={<Send size={22} />}
      size="wide"
      onClose={onClose}
    >
      <ul className="performance-report-selection">
        {items.map((i) => (
          <li key={i.id}>
            <strong>{i.employeeName}</strong>
            <span>{reviewTitle(i)}</span>
            <b>{i.managerAssessment?.score}%</b>
          </li>
        ))}
      </ul>
      {!recipients.length ? (
        <p role="status">
          {t("Chưa có cấp trên phù hợp cho toàn bộ đánh giá đã chọn.")}
        </p>
      ) : (
        <Form
          schema={performanceReportSchema}
          defaults={{
            title: "",
            reviewerId: "",
            reason: "",
            reviews: items.map((i) => ({ id: i.id, version: i.version })),
          }}
          fields={[
            { name: "title", label: "Tên báo cáo", required: true },
            {
              name: "reviewerId",
              label: "Cấp trên xem xét",
              type: "select",
              required: true,
              options: [
                { value: "", label: t("Chọn người xem xét"), disabled: true },
                ...recipients.map((r) => ({ value: r.id, label: r.name })),
              ],
            },
            {
              name: "reason",
              label: "Tóm tắt báo cáo",
              type: "textarea",
              required: true,
            },
          ]}
          submitLabel={t("Gửi báo cáo")}
          onCancel={onClose}
          onSubmit={async (body) => {
            await save.mutateAsync({ path: "/performance/reports", body });
            onSaved();
          }}
        />
      )}
    </Modal>
  );
}
function ReportBadge({ report }: { report: PerformanceReportView }) {
  return (
    <span
      className="badge status-tone"
      data-tone={report.status === "finalized" ? "success" : "warning"}
    >
      {t(performanceReportLabels[report.status])}
    </span>
  );
}
export function PerformanceReports({
  workspace,
  onOpenReview,
}: {
  workspace: PerformanceWorkspace;
  onOpenReview: (id: string) => void;
}) {
  useLocale();
  const [page, setPage] = useState(1),
    [detailId, setDetail] = useState<string | null>(null);
  const [decision, setDecision] = useState<{
    id: string;
    action: "finalize" | "return";
  } | null>(null);
  const save = useAction();
  const reports = workspace.reports ?? [],
    detail = reports.find((r) => r.id === detailId),
    decisionItem = reports.find((r) => r.id === decision?.id);
  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(reports.length / 12)),
  );
  return (
    <>
      <DataTable
        title={t("Báo cáo đánh giá")}
        icon={<FileCheck2 size={20} />}
        data={{
          items: reports.slice((currentPage - 1) * 12, currentPage * 12),
          total: reports.length,
          page: currentPage,
          pageSize: 12,
        }}
        onPage={setPage}
        columns={[
          {
            label: t("Báo cáo"),
            minWidth: 240,
            render: (r) => (
              <div className="performance-list-dates">
                <strong>{r.title}</strong>
                <small>{t("{0} đánh giá", [r.reviewIds.length])}</small>
              </div>
            ),
          },
          { label: t("Người gửi"), minWidth: 160, render: (r) => r.senderName },
          {
            label: t("Cấp trên xem xét"),
            minWidth: 160,
            render: (r) => r.reviewerName,
          },
          {
            label: t("Trạng thái"),
            minWidth: 190,
            render: (r) => <ReportBadge report={r} />,
          },
          {
            label: t("Thao tác"),
            minWidth: 140,
            render: (r) => (
              <Button variant="ghost" onClick={() => setDetail(r.id)}>
                {t(r.canDecide ? "Xem xét báo cáo" : "Xem chi tiết")}
                <ArrowUpRight size={16} />
              </Button>
            ),
          },
        ]}
      />
      {detail && (
        <Modal
          title={detail.title}
          description={`${detail.senderName} → ${detail.reviewerName}`}
          icon={<FileCheck2 size={22} />}
          size="wide"
          onClose={() => setDetail(null)}
        >
          <div className="performance-detail-meta">
            <ReportBadge report={detail} />
            <span>
              {new Date(detail.createdAt!).toLocaleString(intlLocale())}
            </span>
          </div>
          <p className="performance-report-note">{detail.reason}</p>
          <ul className="performance-report-selection">
            {detail.reviewIds.map((id) => {
              const item = workspace.items.find((i) => i.id === id);
              return item ? (
                <li key={id}>
                  <div>
                    <strong>{item.employeeName}</strong>
                    <small>
                      {item.managerAssessment?.name} · {reviewTitle(item)}
                    </small>
                  </div>
                  <b>{item.managerAssessment?.score ?? "—"}%</b>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setDetail(null);
                      onOpenReview(id);
                    }}
                  >
                    {t(detail.canDecide ? "Xem & chỉnh sửa" : "Xem chi tiết")}
                  </Button>
                </li>
              ) : null;
            })}
          </ul>
          {detail.decisionNote && (
            <section className="performance-final-note">
              <h3>{t("Quyết định cấp trên")}</h3>
              <p>{detail.decisionNote}</p>
            </section>
          )}
          <div className="form-actions">
            {detail.canDecide && (
              <>
                <Button
                  variant="secondary"
                  tone="danger"
                  onClick={() => {
                    setDecision({ id: detail.id, action: "return" });
                    setDetail(null);
                  }}
                >
                  {t("Trả lại báo cáo")}
                </Button>
                <Button
                  tone="success"
                  onClick={() => {
                    setDecision({ id: detail.id, action: "finalize" });
                    setDetail(null);
                  }}
                >
                  {t("Chốt & công bố")}
                </Button>
              </>
            )}
          </div>
        </Modal>
      )}
      {decision && decisionItem && (
        <Modal
          title={t(
            decision.action === "finalize"
              ? "Chốt & công bố"
              : "Trả lại báo cáo",
          )}
          description={decisionItem.title}
          onClose={() => setDecision(null)}
        >
          <Form
            schema={performanceActionSchema}
            defaults={{ version: decisionItem.version, reason: "" }}
            fields={[
              {
                name: "reason",
                label: "Quyết định cấp trên",
                type: "textarea",
                required: true,
              },
            ]}
            submitLabel={t(
              decision.action === "finalize"
                ? "Chốt & công bố"
                : "Trả lại báo cáo",
            )}
            submitTone={decision.action === "finalize" ? "success" : "danger"}
            onCancel={() => setDecision(null)}
            onSubmit={async (body) => {
              await save.mutateAsync({
                path: `/performance/reports/${decision.id}/${decision.action}`,
                body,
              });
              setDecision(null);
            }}
          />
        </Modal>
      )}
    </>
  );
}
