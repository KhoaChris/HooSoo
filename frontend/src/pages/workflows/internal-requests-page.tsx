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
      `${r.title} ${r.employeeName} ${requestLabels[r.kind]}`
        .toLocaleLowerCase("vi")
        .includes(search.toLocaleLowerCase("vi")),
  );
  const fields: FormField[] = [
    { name: "title", label: "Tiêu đề đề nghị", required: true, span: "full" },
    {
      name: "startDate",
      label:
        kind === "attendance_correction" ? "Ngày cần điều chỉnh" : "Từ ngày",
      type: "date",
      required: true,
    },
    {
      name: "endDate",
      label:
        kind === "attendance_correction"
          ? "Xác nhận ngày điều chỉnh"
          : "Đến ngày",
      type: "date",
      required: true,
    },
    ...(kind === "attendance_correction"
      ? [
          {
            name: "checkIn",
            label: "Giờ vào đề nghị",
            type: "time" as const,
            required: true,
          },
          {
            name: "checkOut",
            label: "Giờ ra đề nghị",
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
                  ? "Địa điểm công tác"
                  : "Địa điểm làm việc",
              required: true,
              span: "full" as const,
            },
          ]
        : []),
    {
      name: "reason",
      label:
        kind === "employment_certificate"
          ? "Nội dung cần xác nhận & mục đích sử dụng"
          : "Lý do & nội dung công việc",
      type: "textarea",
      required: true,
      span: "full",
      hint:
        kind === "attendance_correction"
          ? "Nhân sự xác nhận cuối sẽ cập nhật bản ghi chấm công và lưu lịch sử điều chỉnh."
          : "Quản lý trực tiếp duyệt trước, nhân sự xác nhận cuối. Bạn có thể theo dõi phản hồi trong chi tiết phiếu.",
    },
  ];
  return (
    <>
      <Heading
        title={approvals ? "Duyệt phiếu đề nghị" : "Phiếu đề nghị của tôi"}
        description={
          approvals
            ? "Xem nội dung, kiểm tra căn cứ và phản hồi cho nhân viên."
            : "Gửi đề nghị công việc và theo dõi từng bước phê duyệt."
        }
        action={
          !approvals && (
            <Button onClick={() => setChoose(true)}>
              <Plus size={17} />
              Tạo phiếu đề nghị
            </Button>
          )
        }
      />
      <DataTable
        title={
          approvals ? "Đề nghị trong phạm vi quản lý" : "Danh sách đề nghị"
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
                aria-label="Tìm phiếu đề nghị"
                placeholder="Tìm theo tiêu đề, nhân viên…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <Select
              aria-label="Trạng thái phiếu"
              value={status}
              onValueChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
              options={[
                { value: "", label: "Tất cả trạng thái" },
                { value: "pending", label: "Đang chờ duyệt" },
                { value: "approved", label: "Đã duyệt" },
                { value: "rejected", label: "Từ chối" },
                { value: "cancelled", label: "Đã hủy" },
              ]}
            />
            <Select
              aria-label="Năm đề nghị"
              value={year}
              onValueChange={(v) => {
                setYear(v);
                setPage(1);
              }}
              options={Array.from({ length: 5 }, (_, i) => ({
                value: String(Number(today().slice(0, 4)) - 2 + i),
                label: `Năm ${Number(today().slice(0, 4)) - 2 + i}`,
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
            label: "Đề nghị",
            render: (r) => (
              <div className="cell-catalog">
                <span className="cell-catalog-icon">
                  <FileText size={18} />
                </span>
                <div>
                  <strong>{r.title}</strong>
                  <small>{requestLabels[r.kind]}</small>
                </div>
              </div>
            ),
          },
          ...(approvals
            ? [
                {
                  label: "Người gửi",
                  render: (r: InternalRequestView) => (
                    <strong>{r.employeeName}</strong>
                  ),
                },
              ]
            : []),
          {
            label: "Thời gian",
            render: (r) => (
              <span>
                {dayLabel(r.startDate)}
                {r.endDate !== r.startDate && (
                  <small className="workflow-cell-subtext">
                    đến {dayLabel(r.endDate)}
                  </small>
                )}
              </span>
            ),
          },
          {
            label: "Tiến độ",
            render: (r) => <WorkflowBadge status={r.status} />,
          },
          {
            label: "Thao tác",
            render: (r) => (
              <Button variant="ghost" onClick={() => setDetail(r)}>
                {r.canReview ? "Xem & phê duyệt" : "Xem chi tiết"}
              </Button>
            ),
          },
        ]}
      />
      {choose && (
        <Modal
          title="Bạn cần hỗ trợ điều gì?"
          description="Chọn loại phiếu phù hợp để bắt đầu."
          onClose={() => setChoose(false)}
        >
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
                    <strong>{requestLabels[k]}</strong>
                    <small>
                      {k === "attendance_correction"
                        ? "Bổ sung hoặc sửa giờ vào / ra đã ghi nhận"
                        : k === "business_trip"
                          ? "Đăng ký kế hoạch, thời gian và địa điểm công tác"
                          : k === "remote_work"
                            ? "Đề xuất thời gian và nơi làm việc từ xa"
                            : "Yêu cầu xác nhận thông tin công việc và nhân sự"}
                    </small>
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
          title={requestLabels[kind]}
          icon={<FileText size={22} />}
          size="wide"
          onClose={() => setKind(null)}
        >
          <Form
            schema={internalRequestSchema}
            columns={2}
            defaults={{
              kind,
              title: requestLabels[kind],
              startDate: today(),
              endDate: today(),
              checkIn: "",
              checkOut: "",
              location: "",
              reason: "",
            }}
            fields={fields}
            submitLabel="Gửi đề nghị"
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
          description={`${requestLabels[detail.kind]} · ${detail.employeeName}`}
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
              <dt>Thời gian</dt>
              <dd>
                {dayLabel(detail.startDate)} – {dayLabel(detail.endDate)}
              </dd>
            </div>
            {detail.location && (
              <div>
                <dt>Địa điểm</dt>
                <dd>{detail.location}</dd>
              </div>
            )}
            {detail.kind === "attendance_correction" && (
              <div>
                <dt>Giờ vào / ra đề nghị</dt>
                <dd>
                  {detail.checkIn} – {detail.checkOut}
                </dd>
              </div>
            )}
          </dl>
          <h3>Nội dung đề nghị</h3>
          <p className="workflow-prose">{detail.reason}</p>
          {detail.resolution && (
            <div className="workflow-resolution">
              <strong>Phản hồi từ nhân sự</strong>
              <p>{detail.resolution}</p>
            </div>
          )}
          <h3>Lịch sử xử lý</h3>
          <WorkflowHistory history={detail.history} />
          <div className="workflow-actions">
            {detail.canReview && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setReview({ record: detail, action: "reject" });
                    setDetail(null);
                  }}
                >
                  Từ chối
                </Button>
                <Button
                  onClick={() => {
                    setReview({ record: detail, action: "approve" });
                    setDetail(null);
                  }}
                >
                  Duyệt đề nghị
                </Button>
              </>
            )}
            {detail.canCancel && (
              <Button
                variant="secondary"
                onClick={() => {
                  setReview({ record: detail, action: "cancel" });
                  setDetail(null);
                }}
              >
                Rút đề nghị
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
