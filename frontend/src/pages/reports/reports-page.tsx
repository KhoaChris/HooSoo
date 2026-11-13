import { t, useLocale } from "../../i18n";
import { Input } from "../../components/ui";
import { useState } from "react";
import {
  Download,
  UsersRound,
  Clock,
  CalendarDays,
  Wallet,
  Info,
} from "lucide-react";
import type { Page, EmployeeView } from "@hoosoo/shared";
import { labels } from "@hoosoo/shared";
import { useApi } from "../../hooks/data";
import { api, queryString } from "../../services/api-client";
import { useCatalogs } from "../../hooks/catalogs";
import { today, dateText, timeText } from "../../utils/date-time";
import {
  Heading,
  Select,
  Button,
  Badge,
  ErrorBox,
  DataTable,
  DateFilters,
} from "../../components/ui";

type Row = { id: string } & Record<string, unknown>;

export function ReportsPage() {
  useLocale();
  const [kind, setKind] = useState("employees"),
    [filters, setFilters] = useState({
      page: 1,
      startDate: today().slice(0, 8) + "01",
      endDate: today(),
      departmentId: "",
      employeeId: "",
      status: "",
      year: Number(today().slice(0, 4)),
    });
  const [exporting, setExporting] = useState(false),
    [error, setError] = useState<Error | null>(null);
  const query = {
    ...filters,
    ...(kind === "employees" || kind === "balances"
      ? { startDate: undefined, endDate: undefined }
      : {}),
    ...(kind === "balances" ? { status: undefined } : {}),
  };
  const q = useApi<
    Page<Row> & { summary: { total: number }; exportScope: string }
  >("/reports/" + kind + queryString(query));
  const { departments, positions } = useCatalogs();
  const staff = useApi<Page<EmployeeView>>("/employees?pageSize=100");
  async function download() {
    setExporting(true);
    setError(null);
    try {
      const blob = await api<Blob>(
        "/reports/export" + queryString({ ...query, kind }),
        { download: true },
      );
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = "hoosoo-" + kind + "-" + today() + ".csv";
      a.click();
      URL.revokeObjectURL(href);
    } catch (e) {
      setError(e as Error);
    } finally {
      setExporting(false);
    }
  }
  const keys: Record<string, string[][]> = {
    employees: [
      ["employeeCode", t("Mã nhân viên")],
      ["name", t("Họ tên")],
      ["departmentId", t("Phòng ban")],
      ["positionId", t("Chức danh")],
      ["status", t("Trạng thái")],
    ],
    attendance: [
      ["employeeName", t("Nhân viên")],
      ["date", t("Ngày")],
      ["checkIn", t("Giờ vào")],
      ["checkOut", t("Giờ ra")],
      ["presenceMinutes", t("Phút hiện diện")],
      ["paidMinutes", t("Phút tính công")],
      ["status", t("Trạng thái")],
    ],
    leave: [
      ["employeeName", t("Nhân viên")],
      ["typeName", t("Loại phép")],
      ["startDate", t("Từ ngày")],
      ["endDate", t("Đến ngày")],
      ["days", t("Số ngày")],
      ["status", t("Trạng thái")],
    ],
    balances: [
      ["employeeName", t("Nhân viên")],
      ["year", t("Năm")],
      ["allowance", t("Hạn mức")],
      ["used", t("Đã duyệt")],
      ["pending", t("Chờ duyệt")],
      ["available", t("Khả dụng")],
    ],
  };
  function display(key: string, value: unknown) {
    if (value === null || value === undefined) return "—";
    if (key === "departmentId")
      return departments.data?.items.find((d) => d.id === value)?.name;
    if (key === "positionId")
      return positions.data?.items.find((p) => p.id === value)?.name;
    if (["date", "startDate", "endDate"].includes(key))
      return dateText(String(value));
    if (["checkIn", "checkOut"].includes(key)) return timeText(String(value));
    if (key === "status") return <Badge value={String(value)} />;
    if (key === "employeeCode")
      return <span className="cell-code">{String(value)}</span>;
    if (key === "name" || key === "employeeName")
      return <strong>{String(value)}</strong>;
    return String(value);
  }
  const reportTitles: Record<string, string> = {
    employees: t("Danh sách nhân sự"),
    attendance: t("Tổng hợp chấm công"),
    leave: t("Tổng hợp nghỉ phép"),
    balances: t("Số dư phép năm"),
  };
  const reportIcons = {
    employees: <UsersRound size={16} />,
    attendance: <Clock size={16} />,
    leave: <CalendarDays size={16} />,
    balances: <Wallet size={16} />,
  };
  const statuses: Record<string, string[]> = {
    employees: ["active", "probation", "terminated"],
    attendance: ["on_time", "late", "missing_checkout", "working"],
    leave: ["pending", "approved", "rejected", "cancelled"],
    balances: [],
  };
  return (
    <>
      <Heading
        title={t("Báo cáo nhân sự")}
        action={
          <Button
            variant="secondary"
            busy={exporting}
            onClick={() => void download()}
          >
            <Download size={16} />
            {t("Xuất CSV")}
          </Button>
        }
      />
      <ErrorBox error={error} />
      <DataTable
        title={reportTitles[kind]}
        icon={reportIcons[kind as keyof typeof reportIcons]}
        loading={q.isPending}
        error={q.error}
        onRetry={() => void q.refetch()}
        toolbar={
          <>
            <div
              className="report-tabs"
              role="tablist"
              aria-label={t("Loại báo cáo")}
            >
              {[
                ["employees", t("Nhân viên")],
                ["attendance", t("Chấm công")],
                ["leave", t("Nghỉ phép")],
                ["balances", t("Số dư phép")],
              ].map(([value, label]) => (
                <button
                  role="tab"
                  aria-selected={kind === value}
                  className={kind === value ? "selected" : ""}
                  key={value}
                  onClick={() => {
                    setKind(value);
                    setFilters({ ...filters, page: 1, status: "" });
                  }}
                >
                  {reportIcons[value as keyof typeof reportIcons]}
                  {label}
                </button>
              ))}
            </div>
            <div className="filters">
              {["attendance", "leave"].includes(kind) && (
                <DateFilters
                  start={filters.startDate}
                  end={filters.endDate}
                  onChange={(startDate, endDate) =>
                    setFilters({ ...filters, startDate, endDate, page: 1 })
                  }
                />
              )}{" "}
              {kind === "balances" && (
                <label className="filter-label">
                  {t("Năm")}
                  <Input
                    type="number"
                    value={filters.year}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        year: Number(e.target.value),
                        page: 1,
                      })
                    }
                  />
                </label>
              )}
              <Select
                aria-label={t("Phòng ban")}
                value={filters.departmentId}
                onValueChange={(value) =>
                  setFilters({ ...filters, departmentId: value, page: 1 })
                }
                options={[
                  { value: "", label: t("Tất cả phòng ban") },
                  ...(departments.data?.items.map((item) => ({
                    value: item.id,
                    label: item.name,
                  })) ?? []),
                ]}
              />
              <Select
                aria-label={t("Nhân viên")}
                value={filters.employeeId}
                onValueChange={(value) =>
                  setFilters({ ...filters, employeeId: value, page: 1 })
                }
                options={[
                  { value: "", label: t("Tất cả nhân viên") },
                  ...(staff.data?.items.map((item) => ({
                    value: item.id,
                    label: item.name,
                  })) ?? []),
                ]}
              />
              {statuses[kind].length > 0 && (
                <Select
                  aria-label={t("Trạng thái")}
                  value={filters.status}
                  onValueChange={(value) =>
                    setFilters({ ...filters, status: value, page: 1 })
                  }
                  options={[
                    { value: "", label: t("Tất cả trạng thái") },
                    ...statuses[kind].map((status) => ({
                      value: status,
                      label: t(labels[status]),
                    })),
                  ]}
                />
              )}
              {(filters.departmentId ||
                filters.employeeId ||
                filters.status ||
                filters.startDate !== today().slice(0, 8) + "01" ||
                filters.endDate !== today() ||
                filters.year !== Number(today().slice(0, 4))) && (
                <Button
                  variant="ghost"
                  className="filter-reset"
                  onClick={() =>
                    setFilters({
                      page: 1,
                      startDate: today().slice(0, 8) + "01",
                      endDate: today(),
                      departmentId: "",
                      employeeId: "",
                      status: "",
                      year: Number(today().slice(0, 4)),
                    })
                  }
                >
                  {t("Đặt lại")}
                </Button>
              )}
            </div>
          </>
        }
        footerNote={
          <>
            <Info size={14} />
            <span>{t("CSV · Tối đa 5.000 dòng")}</span>
          </>
        }
        data={q.data}
        filtered
        onPage={(page) => setFilters({ ...filters, page })}
        columns={keys[kind].map(([key, label]) => ({
          label,
          minWidth: [
            "name",
            "employeeName",
            "departmentName",
            "positionName",
          ].includes(key)
            ? 240
            : key === "status"
              ? 185
              : 155,
          align: [
            "presenceMinutes",
            "paidMinutes",
            "days",
            "allowance",
            "used",
            "pending",
            "available",
          ].includes(key)
            ? ("right" as const)
            : undefined,
          className: [
            "presenceMinutes",
            "paidMinutes",
            "days",
            "allowance",
            "used",
            "pending",
            "available",
          ].includes(key)
            ? "cell-number"
            : undefined,
          render: (r: Row) => display(key, r[key]),
        }))}
      />
    </>
  );
}
