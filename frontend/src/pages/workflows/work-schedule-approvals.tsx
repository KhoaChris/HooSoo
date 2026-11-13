import { useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Search,
  X,
} from "lucide-react";
import type { WorkRegistrationView } from "@hoosoo/shared";
import { Button, DataTable, Input } from "../../components/ui";
import { PersonCell } from "../../components/ui/person-cell";
import { intlLocale, t, useLocale } from "../../i18n";
import { StableText } from "../../i18n/stable-text";
import { dayLabel, WorkflowBadge } from "./workflow-ui";

const filters = [
  { id: "all", label: "Tất cả" },
  { id: "pending", label: "Chờ duyệt" },
  { id: "approved", label: "Đã duyệt" },
  { id: "rejected", label: "Đã từ chối" },
  { id: "cancelled", label: "Đã hủy" },
] as const;
type StatusFilter = (typeof filters)[number]["id"];
const matchesStatus = (row: WorkRegistrationView, status: StatusFilter) =>
  status === "all" ||
  (status === "pending"
    ? row.status === "pending_manager" || row.status === "pending_hr"
    : row.status === status);
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim();

export function WorkScheduleApprovals({
  month,
  rows,
  loading,
  error,
  onRetry,
  onMonth,
  onToday,
  page,
  onPage,
  onOpen,
}: {
  month: string;
  rows: WorkRegistrationView[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  onMonth: (delta: number) => void;
  onToday: () => void;
  page: number;
  onPage: (page: number) => void;
  onOpen: (row: WorkRegistrationView) => void;
}) {
  useLocale();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const query = normalize(search);
  const matched = rows.filter((row) =>
    normalize(`${row.employeeName} ${row.employeeCode}`).includes(query),
  );
  const filtered = matched.filter((row) => matchesStatus(row, status));
  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(filtered.length / 15)),
  );
  const monthLabel = new Intl.DateTimeFormat(intlLocale(), {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(`${month}-01T12:00:00+07:00`));

  return (
    <div className="schedule-approvals">
      <DataTable
        title={
          monthLabel.charAt(0).toLocaleUpperCase(intlLocale()) +
          monthLabel.slice(1)
        }
        icon={<CalendarDays size={20} />}
        loading={loading}
        error={error}
        onRetry={onRetry}
        filtered={!!query || status !== "all"}
        data={{
          items: filtered.slice((currentPage - 1) * 15, currentPage * 15),
          page: currentPage,
          pageSize: 15,
          total: filtered.length,
        }}
        onPage={filtered.length > 15 ? onPage : undefined}
        actions={
          <div
            className="schedule-month-controls"
            role="group"
            aria-label={t("Chọn tháng")}
          >
            <Button
              variant="secondary"
              aria-label={t("Tháng trước")}
              onClick={() => onMonth(-1)}
            >
              <ChevronLeft size={17} />
            </Button>
            <Button variant="secondary" onClick={onToday}>
              {t("Hôm nay")}
            </Button>
            <Button
              variant="secondary"
              aria-label={t("Tháng sau")}
              onClick={() => onMonth(1)}
            >
              <ChevronRight size={17} />
            </Button>
          </div>
        }
        toolbar={
          <div className="schedule-approval-filters">
            <div
              className="schedule-status-filters"
              role="group"
              aria-label={t("Lọc theo trạng thái")}
            >
              {filters.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  aria-pressed={status === filter.id}
                  onClick={() => {
                    setStatus(filter.id);
                    onPage(1);
                  }}
                >
                  <StableText>{t(filter.label)}</StableText>
                  <span className="schedule-filter-count">
                    {loading || error
                      ? "—"
                      : matched.filter((row) => matchesStatus(row, filter.id))
                          .length}
                  </span>
                </button>
              ))}
            </div>
            <div className="schedule-search search-input">
              <Search size={16} aria-hidden="true" />
              <Input
                type="search"
                aria-label={t("Tìm nhân viên")}
                placeholder={t("Tên hoặc mã nhân viên…")}
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  onPage(1);
                }}
              />
              {search && (
                <button
                  type="button"
                  className="schedule-search-clear"
                  aria-label={t("Xóa tìm kiếm")}
                  onClick={() => {
                    setSearch("");
                    onPage(1);
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        }
        columns={[
          {
            label: t("Nhân viên"),
            minWidth: 250,
            render: (row) => (
              <PersonCell name={row.employeeName} detail={row.employeeCode} />
            ),
          },
          {
            label: t("Ngày làm việc"),
            minWidth: 150,
            render: (row) => (
              <div className="cell-stack">
                <strong>{dayLabel(row.date)}</strong>
                <small>
                  {new Intl.DateTimeFormat(intlLocale(), {
                    weekday: "long",
                    timeZone: "Asia/Ho_Chi_Minh",
                  }).format(new Date(`${row.date}T12:00:00+07:00`))}
                </small>
              </div>
            ),
          },
          {
            label: t("Khung giờ"),
            minWidth: 160,
            render: (row) => (
              <span className="schedule-time">
                <Clock3 size={15} aria-hidden="true" />
                <span>
                  {row.start} – {row.end}
                </span>
              </span>
            ),
          },
          {
            label: t("Trạng thái"),
            minWidth: 230,
            render: (row) => <WorkflowBadge status={row.status} />,
          },
          {
            label: t("Thao tác"),
            minWidth: 210,
            align: "right",
            render: (row) => (
              <Button
                className={`schedule-review-action ${row.canReview ? "is-reviewable" : ""}`}
                variant="ghost"
                onClick={() => onOpen(row)}
              >
                {row.canReview ? t("Xem & phê duyệt") : t("Xem chi tiết")}
                <ArrowUpRight size={15} aria-hidden="true" />
              </Button>
            ),
          },
        ]}
      />
    </div>
  );
}
