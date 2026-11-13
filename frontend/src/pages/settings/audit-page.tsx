import { t, useLocale } from "../../i18n";
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
  useLocale();
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
      <Heading eyebrow={t("QUẢN TRỊ")} title={t("Nhật ký thao tác")} />
      <DataTable
        title={t("Lịch sử hoạt động")}
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
                aria-label={t("Loại thao tác")}
                value={draft.search}
                onValueChange={(search) => setDraft({ ...draft, search })}
                options={[
                  { value: "", label: t("Tất cả thao tác") },
                  ...Object.entries(auditActions).map(([value, label]) => ({
                    value,
                    label: t(label),
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
                {t("Áp dụng")}
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
                  {t("Đặt lại")}
                </Button>
              )}
            </div>
            {invalidDates && (
              <p className="field-error" role="alert">
                {t("Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.")}
              </p>
            )}
          </form>
        }
        columns={[
          {
            minWidth: 230,
            label: t("Hoạt động"),
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
            minWidth: 220,
            label: t("Người thực hiện"),
            render: (r) => (
              <PersonCell
                name={auditActor(r.actorId, lookups)}
                avatarUrl={
                  staff.data?.items.find((e) => e.uid === r.actorId)?.avatarUrl
                }
              />
            ),
          },
          {
            minWidth: 340,
            label: t("Nội dung ghi nhận"),
            className: "cell-wrap",
            render: (r) => (
              <div className="audit-summary">
                <span>{auditSummary(r, lookups)}</span>
                {r.reason && <small title={r.reason}>{r.reason}</small>}
              </div>
            ),
          },
          {
            minWidth: 170,
            label: t("Thời gian"),
            render: (r) => (
              <div className="cell-stack">
                <strong>{timeText(r.createdAt)}</strong>
                <small>{dateText(r.createdAt)}</small>
              </div>
            ),
          },
          {
            minWidth: 150,
            label: t("Chi tiết"),
            className: "cell-actions",
            render: (r) => (
              <Button
                variant="ghost"
                className="audit-open"
                aria-label={t("Xem chi tiết {0}", [auditTitle(r)])}
                onClick={() => setDetail(r)}
              >
                {t("Xem chi tiết")}
                <ArrowUpRight size={14} />
              </Button>
            ),
          },
        ]}
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
                {t("Người thực hiện")}
                <strong>{auditActor(detail.actorId, lookups)}</strong>
              </span>
            </div>
            <div>
              <Clock3 size={16} />
              <span>
                {t("Thời điểm")}
                <strong>
                  {dateText(detail.createdAt)} · {timeText(detail.createdAt)}
                </strong>
              </span>
            </div>
            <div>
              <FileText size={16} />
              <span>
                {t("Nội dung liên quan")}
                <strong>{auditSubject(detail, lookups)}</strong>
              </span>
              {detail.action.startsWith("leave.") && (
                <Link
                  className="audit-source-link"
                  to={"/leave/" + encodeURIComponent(detail.targetId)}
                >
                  {t("Mở đơn nghỉ phép")} <ArrowUpRight size={14} />
                </Link>
              )}
              {(detail.action.startsWith("employee.") ||
                detail.action === "profile.updated") &&
                lookups.employees[detail.targetId] && (
                  <Link
                    className="audit-source-link"
                    to={"/employees/" + encodeURIComponent(detail.targetId)}
                  >
                    {t("Mở hồ sơ")} <ArrowUpRight size={14} />
                  </Link>
                )}
            </div>
          </div>
          <section className="audit-change-section">
            <h3>
              {changes.comparison
                ? t("Nội dung đã thay đổi")
                : t("Thông tin được ghi nhận")}
            </h3>
            {changes.rows.length ? (
              <div
                className="audit-change-table"
                role="table"
                aria-label={t("Nội dung nhật ký")}
              >
                <div
                  className={`audit-change-head ${changes.comparison ? "comparison" : ""}`}
                  role="row"
                >
                  <span role="columnheader">{t("Thông tin")}</span>
                  {changes.comparison && (
                    <span role="columnheader">{t("Trước thay đổi")}</span>
                  )}
                  <span role="columnheader">
                    {changes.comparison
                      ? t("Sau thay đổi")
                      : t("Giá trị ghi nhận")}
                  </span>
                </div>
                {changes.rows.map((row) => (
                  <div
                    className={`audit-change-row ${changes.comparison ? "comparison" : ""}`}
                    role="row"
                    key={row.key}
                  >
                    <strong role="rowheader">{t(row.label)}</strong>
                    {changes.comparison && (
                      <span role="cell" className="audit-before">
                        <small>{t("Trước")}</small>
                        {row.before}
                      </span>
                    )}
                    <span role="cell" className="audit-after">
                      <small>
                        {changes.comparison ? "Sau" : t("Ghi nhận")}
                      </small>
                      {row.after}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="audit-no-changes">
                {t("Không có chi tiết thay đổi.")}
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
                {t("Lý do / ghi chú")}
              </h3>
              <p>{detail.reason}</p>
            </section>
          )}
          <footer className="audit-detail-footer">
            <Button variant="secondary" onClick={() => setDetail(null)}>
              {t("Đóng chi tiết")}
            </Button>
          </footer>
        </Modal>
      )}
    </>
  );
}
