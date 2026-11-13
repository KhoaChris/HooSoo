import { StableText } from "../../i18n/stable-text";
import { t, useLocale } from "../../i18n";
import { useState } from "react";
import {
  Plus,
  FileText,
  Clock3,
  MapPin,
  Laptop,
  BadgeCheck,
  Search,
} from "lucide-react";
import {
  internalRequestSchema,
  requestKinds,
  requestLabels,
  type InternalRequestView,
} from "@hoosoo/shared";
import { useApi, useAction } from "../../hooks/data";
import {
  Heading,
  Button,
  Form,
  Modal,
  DataTable,
  Select,
  Input,
  type FormField,
} from "../../components/ui";
import {
  WorkflowBadge,
  WorkflowHistory,
  ApprovalSteps,
  ReviewDialog,
  today,
  dayLabel,
} from "./workflow-ui";
const icons = {
  attendance_correction: Clock3,
  business_trip: MapPin,
  remote_work: Laptop,
  employment_certificate: BadgeCheck,
};
export function InternalRequestsPage({
  approvals = false,
}: {
  approvals?: boolean;
}) {
  useLocale();
  const [kind, setKind] = useState<(typeof requestKinds)[number] | null>(null),
    [choose, setChoose] = useState(false),
    [detailRecord, setDetail] = useState<InternalRequestView | null>(null),
    [review, setReview] = useState<{
      record: InternalRequestView;
      action: "approve" | "reject" | "cancel";
    } | null>(null),
    [status, setStatus] = useState(""),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [year, setYear] = useState(today().slice(0, 4));
  const q = useApi<{ items: InternalRequestView[] }>(
      `/internal-requests?startDate=${year}-01-01&endDate=${year}-12-31${approvals ? "&approvals=true" : ""}`,
    ),
    save = useAction();
  const detail = q.data?.items.find((r) => r.id === detailRecord?.id);
  const rows = (q.data?.items ?? []).filter(
    (r) =>
      (!status ||
        (status === "pending"
          ? r.status.startsWith("pending_")
          : r.status === status)) &&
      `${r.title} ${r.employeeName} ${t(requestLabels[r.kind])}`
        .toLocaleLowerCase("vi")
        .includes(search.toLocaleLowerCase("vi")),
  );
  const fields: FormField[] = [
    {
      name: "title",
      label: t("Tiêu đề đề nghị"),
      required: true,
      span: "full",
    },
    {
      name: "startDate",
      label:
        kind === "attendance_correction"
          ? t("Ngày cần điều chỉnh")
          : t("Từ ngày"),
      type: "date",
      required: true,
    },
    {
      name: "endDate",
      label:
        kind === "attendance_correction"
          ? t("Xác nhận ngày điều chỉnh")
          : t("Đến ngày"),
      type: "date",
      required: true,
    },
    ...(kind === "attendance_correction"
      ? [
          {
            name: "checkIn",
            label: t("Giờ vào đề nghị"),
            type: "time" as const,
            required: true,
          },
          {
            name: "checkOut",
            label: t("Giờ ra đề nghị"),
            type: "time" as const,
            required: true,
          },
        ]
      : kind !== "employment_certificate"
        ? [
            {
              name: "location",
              label:
                kind === "business_trip"
                  ? t("Địa điểm công tác")
                  : t("Địa điểm làm việc"),
              required: true,
              span: "full" as const,
            },
          ]
        : []),
    {
      name: "reason",
      label:
        kind === "employment_certificate"
          ? t("Nội dung cần xác nhận & mục đích sử dụng")
          : t("Lý do & nội dung công việc"),
      type: "textarea",
      required: true,
      span: "full",
    },
  ];
  return (
    <>
      <Heading
        title={
          approvals ? t("Duyệt phiếu đề nghị") : t("Phiếu đề nghị của tôi")
        }
        action={
          !approvals && (
            <Button onClick={() => setChoose(true)}>
              <Plus size={17} />
              {t("Tạo phiếu đề nghị")}
            </Button>
          )
        }
      />
      <DataTable
        title={
          approvals
            ? t("Đề nghị trong phạm vi quản lý")
            : t("Danh sách đề nghị")
        }
        icon={<FileText size={18} />}
        loading={q.isPending}
        error={q.error}
        onRetry={() => void q.refetch()}
        filtered={!!status || !!search}
        toolbar={
          <div className="filters">
            <label className="search-input">
              <Search size={16} />
              <Input
                aria-label={t("Tìm phiếu đề nghị")}
                placeholder={t("Tìm theo tiêu đề, nhân viên…")}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <Select
              aria-label={t("Trạng thái phiếu")}
              value={status}
              onValueChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
              options={[
                { value: "", label: t("Tất cả trạng thái") },
                { value: "pending", label: t("Đang chờ duyệt") },
                { value: "approved", label: t("Đã duyệt") },
                { value: "rejected", label: t("Từ chối") },
                { value: "cancelled", label: t("Đã hủy") },
              ]}
            />
            <Select
              aria-label={t("Năm đề nghị")}
              value={year}
              onValueChange={(v) => {
                setYear(v);
                setPage(1);
              }}
              options={Array.from({ length: 5 }, (_, i) => ({
                value: String(Number(today().slice(0, 4)) - 2 + i),
                label: t("Năm {0}", [Number(today().slice(0, 4)) - 2 + i]),
              }))}
            />
          </div>
        }
        data={
          q.data
            ? {
                items: rows.slice((page - 1) * 15, page * 15),
                page,
                pageSize: 15,
                total: rows.length,
              }
            : undefined
        }
        onPage={setPage}
        columns={[
          {
            minWidth: 330,
            label: t("Đề nghị"),
            render: (r) => (
              <div className="cell-catalog">
                <span className="cell-catalog-icon">
                  <FileText size={18} />
                </span>
                <div>
                  <strong>{r.title}</strong>
                  <small>
                    <StableText>{t(requestLabels[r.kind])}</StableText>
                  </small>
                </div>
              </div>
            ),
          },
          ...(approvals
            ? [
                {
                  minWidth: 220,
                  label: t("Người gửi"),
                  render: (r: InternalRequestView) => (
                    <strong>{r.employeeName}</strong>
                  ),
                },
              ]
            : []),
          {
            minWidth: 230,
            label: t("Thời gian"),
            render: (r) => (
              <span>
                {dayLabel(r.startDate)}
                {r.endDate !== r.startDate && (
                  <small className="workflow-cell-subtext">
                    <StableText>{t("đến")}</StableText> {dayLabel(r.endDate)}
                  </small>
                )}
              </span>
            ),
          },
          {
            minWidth: 220,
            label: t("Tiến độ"),
            render: (r) => <WorkflowBadge status={r.status} />,
          },
          {
            minWidth: 160,
            label: t("Thao tác"),
            render: (r) => (
              <Button variant="ghost" onClick={() => setDetail(r)}>
                {r.canReview ? t("Xem & phê duyệt") : t("Xem chi tiết")}
              </Button>
            ),
          },
        ]}
      />
      {choose && (
        <Modal title={t("Tạo phiếu đề nghị")} onClose={() => setChoose(false)}>
          <div className="request-kind-list">
            {requestKinds.map((k) => {
              const Icon = icons[k];
              return (
                <button
                  key={k}
                  onClick={() => {
                    setChoose(false);
                    setKind(k);
                  }}
                >
                  <Icon size={22} />
                  <span>
                    <strong>
                      <StableText>{t(requestLabels[k])}</StableText>
                    </strong>
                  </span>
                  <Plus size={17} />
                </button>
              );
            })}
          </div>
        </Modal>
      )}
      {kind && (
        <Modal
          title={t(requestLabels[kind])}
          icon={<FileText size={22} />}
          size="wide"
          onClose={() => setKind(null)}
        >
          <Form
            schema={internalRequestSchema}
            columns={2}
            defaults={{
              kind,
              title: t(requestLabels[kind]),
              startDate: today(),
              endDate: today(),
              checkIn: "",
              checkOut: "",
              location: "",
              reason: "",
            }}
            fields={fields}
            submitLabel={t("Gửi đề nghị")}
            onSubmit={async (body) => {
              await save.mutateAsync({ path: "/internal-requests", body });
              setKind(null);
            }}
          />
        </Modal>
      )}
      {detail && (
        <Modal
          title={detail.title}
          description={`${t(requestLabels[detail.kind])} · ${detail.employeeName}`}
          size="wide"
          onClose={() => setDetail(null)}
        >
          <WorkflowBadge status={detail.status} />
          <ApprovalSteps
            status={detail.status}
            managerName={detail.managerName}
          />
          <dl className="workflow-facts">
            <div>
              <dt>
                <StableText>{t("Thời gian")}</StableText>
              </dt>
              <dd>
                {dayLabel(detail.startDate)} – {dayLabel(detail.endDate)}
              </dd>
            </div>
            {detail.location && (
              <div>
                <dt>
                  <StableText>{t("Địa điểm")}</StableText>
                </dt>
                <dd>{detail.location}</dd>
              </div>
            )}
            {detail.kind === "attendance_correction" && (
              <div>
                <dt>
                  <StableText>{t("Giờ vào / ra đề nghị")}</StableText>
                </dt>
                <dd>
                  {detail.checkIn} – {detail.checkOut}
                </dd>
              </div>
            )}
          </dl>
          <h3>
            <StableText>{t("Nội dung đề nghị")}</StableText>
          </h3>
          <p className="workflow-prose">{detail.reason}</p>
          {detail.resolution && (
            <div className="workflow-resolution">
              <strong>
                <StableText>{t("Phản hồi từ nhân sự")}</StableText>
              </strong>
              <p>{detail.resolution}</p>
            </div>
          )}
          <h3>
            <StableText>{t("Lịch sử xử lý")}</StableText>
          </h3>
          <WorkflowHistory history={detail.history} />
          <div className="workflow-actions">
            {detail.canReview && (
              <>
                <Button
                  variant="secondary"
                  tone="danger"
                  onClick={() => {
                    setReview({ record: detail, action: "reject" });
                    setDetail(null);
                  }}
                >
                  {t("Từ chối")}
                </Button>
                <Button
                  tone="success"
                  onClick={() => {
                    setReview({ record: detail, action: "approve" });
                    setDetail(null);
                  }}
                >
                  {t("Duyệt đề nghị")}
                </Button>
              </>
            )}
            {detail.canCancel && (
              <Button
                variant="secondary"
                tone="danger"
                onClick={() => {
                  setReview({ record: detail, action: "cancel" });
                  setDetail(null);
                }}
              >
                {t("Rút đề nghị")}
              </Button>
            )}
          </div>
        </Modal>
      )}
      {review && (
        <ReviewDialog
          path={`/internal-requests/${review.record.id}`}
          version={review.record.version}
          action={review.action}
          title={review.record.title}
          onClose={() => setReview(null)}
        />
      )}
    </>
  );
}
