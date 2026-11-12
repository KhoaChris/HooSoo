import { useState } from "react";
import { Link } from "react-router-dom";
import {
  History,
  ArrowUpRight,
  SlidersHorizontal,
  Clock3,
  UserRound,
  FileText,
  MessageSquareText,
} from "lucide-react";
import {
  type Page,
  type EmployeeView,
  type Membership,
  type Audit,
} from "@hoosoo/shared";
import { useApi } from "../../hooks/data";
import { useCatalogs } from "../../hooks/catalogs";
import { dateText, timeText } from "../../utils/date-time";
import {
  Heading,
  Button,
  Modal,
  DataTable,
  Select,
  DateFilters,
} from "../../components/ui";
import { PersonCell } from "../../components/ui/person-cell";
import { queryString } from "../../services/api-client";
import {
  auditActions,
  auditActor,
  auditCategory,
  auditChanges,
  auditSubject,
  auditSummary,
  auditTitle,
  type AuditLookups,
} from "./audit-presentation";

const emptyFilters = { search: "", startDate: "", endDate: "" };
export function AuditPage() {
  const [page, setPage] = useState(1),
    [draft, setDraft] = useState(emptyFilters),
    [filters, setFilters] = useState(emptyFilters),
    [detail, setDetail] = useState<Audit | null>(null);
  const q = useApi<Page<Audit>>(
    "/audit-logs" + queryString({ page, ...filters }),
  );
  const staff = useApi<Page<EmployeeView>>("/employees?pageSize=100"),
    users = useApi<{ items: (Membership & { name?: string })[] }>("/users");
  const { departments, positions } = useCatalogs();
  const employees = Object.fromEntries(
    (staff.data?.items || []).map((e) => [e.id, e.name]),
  );
  const lookups: AuditLookups = {
    employees,
    accounts: Object.fromEntries(
      (users.data?.items || []).map((u) => [
        u.id,
        u.name || employees[u.employeeId] || u.email,
      ]),
    ),
    departments: Object.fromEntries(
      (departments.data?.items || []).map((d) => [d.id, d.name]),
    ),
    positions: Object.fromEntries(
      (positions.data?.items || []).map((p) => [p.id, p.name]),
    ),
  };
  const changes = detail ? auditChanges(detail, lookups) : null;
  const invalidDates = !!(
    draft.startDate &&
    draft.endDate &&
    draft.startDate > draft.endDate
  );
  return (
    <>
      <Heading
        eyebrow="QUẢN TRỊ"
        title="Nhật ký thao tác"
        description="Theo dõi người thực hiện, nội dung thay đổi và thời điểm ghi nhận."
      />
      <DataTable
        title="Lịch sử hoạt động"
        description="Các hoạt động mới nhất được hiển thị trước."
        icon={<History size={18} />}
        data={q.data}
        loading={q.isPending}
        error={q.error}
        onRetry={() => void q.refetch()}
        onPage={setPage}
        filtered={Object.values(filters).some(Boolean)}
        toolbar={
          <form
            className="audit-filters"
            onSubmit={(e) => {
              e.preventDefault();
              if (!invalidDates) {
                setFilters(draft);
                setPage(1);
              }
            }}
          >
            <div className="filters">
              <Select
                aria-label="Loại thao tác"
                value={draft.search}
                onValueChange={(search) => setDraft({ ...draft, search })}
                options={[
                  { value: "", label: "Tất cả thao tác" },
                  ...Object.entries(auditActions).map(([value, label]) => ({
                    value,
                    label,
                  })),
                ]}
              />
              <DateFilters
                start={draft.startDate}
                end={draft.endDate}
                onChange={(startDate, endDate) =>
                  setDraft({ ...draft, startDate, endDate })
                }
              />
              <Button variant="secondary" type="submit" disabled={invalidDates}>
                <SlidersHorizontal size={14} />
                Áp dụng
              </Button>
              {[...Object.values(draft), ...Object.values(filters)].some(
                Boolean,
              ) && (
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => {
                    setDraft(emptyFilters);
                    setFilters(emptyFilters);
                    setPage(1);
                  }}
                >
                  Đặt lại
                </Button>
              )}
            </div>
            {invalidDates && (
              <p className="field-error" role="alert">
                Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.
              </p>
            )}
          </form>
        }
        columns={[
          {
            label: "Hoạt động",
            className: "audit-activity-column",
            render: (r) => (
              <div className="audit-activity">
                <span className="audit-event-icon" aria-hidden="true">
                  <History size={16} />
                </span>
                <div>
                  <strong>{auditTitle(r)}</strong>
                  <small>{auditSubject(r, lookups)}</small>
                </div>
              </div>
            ),
          },
          {
            label: "Người thực hiện",
            render: (r) => <PersonCell name={auditActor(r.actorId, lookups)} />,
          },
          {
            label: "Nội dung ghi nhận",
            className: "cell-wrap",
            render: (r) => (
              <div className="audit-summary">
                <span>{auditSummary(r, lookups)}</span>
                {r.reason && <small title={r.reason}>{r.reason}</small>}
              </div>
            ),
          },
          {
            label: "Thời gian",
            render: (r) => (
              <div className="cell-stack">
                <strong>{timeText(r.createdAt)}</strong>
                <small>{dateText(r.createdAt)}</small>
              </div>
            ),
          },
          {
            label: "Chi tiết",
            className: "cell-actions",
            render: (r) => (
              <Button
                variant="ghost"
                className="audit-open"
                aria-label={`Xem chi tiết ${auditTitle(r)}`}
                onClick={() => setDetail(r)}
              >
                Xem chi tiết
                <ArrowUpRight size={14} />
              </Button>
            ),
          },
        ]}
        footerNote="Nhật ký được lưu tự động khi thao tác hoàn tất và chỉ có thể xem."
      />
      {detail && changes && (
        <Modal
          title={auditTitle(detail)}
          description={auditCategory(detail.action)}
          icon={<History size={21} />}
          size="wide"
          onClose={() => setDetail(null)}
        >
          <div className="audit-detail-meta">
            <div>
              <UserRound size={16} />
              <span>
                Người thực hiện
                <strong>{auditActor(detail.actorId, lookups)}</strong>
              </span>
            </div>
            <div>
              <Clock3 size={16} />
              <span>
                Thời điểm
                <strong>
                  {dateText(detail.createdAt)} · {timeText(detail.createdAt)}
                </strong>
              </span>
            </div>
            <div>
              <FileText size={16} />
              <span>
                Nội dung liên quan
                <strong>{auditSubject(detail, lookups)}</strong>
              </span>
              {detail.action.startsWith("leave.") && (
                <Link
                  className="audit-source-link"
                  to={"/leave/" + encodeURIComponent(detail.targetId)}
                >
                  Mở đơn nghỉ phép <ArrowUpRight size={14} />
                </Link>
              )}
              {(detail.action.startsWith("employee.") ||
                detail.action === "profile.updated") &&
                lookups.employees[detail.targetId] && (
                  <Link
                    className="audit-source-link"
                    to={"/employees/" + encodeURIComponent(detail.targetId)}
                  >
                    Mở hồ sơ <ArrowUpRight size={14} />
                  </Link>
                )}
            </div>
          </div>
          <section className="audit-change-section">
            <h3>
              {changes.comparison
                ? "Nội dung đã thay đổi"
                : "Thông tin được ghi nhận"}
            </h3>
            {changes.rows.length ? (
              <div
                className="audit-change-table"
                role="table"
                aria-label="Nội dung nhật ký"
              >
                <div
                  className={`audit-change-head ${changes.comparison ? "comparison" : ""}`}
                  role="row"
                >
                  <span role="columnheader">Thông tin</span>
                  {changes.comparison && (
                    <span role="columnheader">Trước thay đổi</span>
                  )}
                  <span role="columnheader">
                    {changes.comparison ? "Sau thay đổi" : "Giá trị ghi nhận"}
                  </span>
                </div>
                {changes.rows.map((row) => (
                  <div
                    className={`audit-change-row ${changes.comparison ? "comparison" : ""}`}
                    role="row"
                    key={row.key}
                  >
                    <strong role="rowheader">{row.label}</strong>
                    {changes.comparison && (
                      <span role="cell" className="audit-before">
                        <small>Trước</small>
                        {row.before}
                      </span>
                    )}
                    <span role="cell" className="audit-after">
                      <small>{changes.comparison ? "Sau" : "Ghi nhận"}</small>
                      {row.after}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="audit-no-changes">
                Hoạt động đã được ghi nhận. Không có thông tin thay đổi chi tiết
                trong nhật ký này.
              </p>
            )}
            {changes.note && (
              <p className="audit-detail-note">{changes.note}</p>
            )}
          </section>
          {detail.reason && (
            <section className="audit-reason">
              <h3>
                <MessageSquareText size={16} />
                Lý do / ghi chú
              </h3>
              <p>{detail.reason}</p>
            </section>
          )}
          <footer className="audit-detail-footer">
            <p>Tên người và đơn vị được đối chiếu với danh sách hiện tại.</p>
            <Button variant="secondary" onClick={() => setDetail(null)}>
              Đóng chi tiết
            </Button>
          </footer>
        </Modal>
      )}
    </>
  );
}
