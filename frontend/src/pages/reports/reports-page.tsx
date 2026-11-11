import { Input } from "../../components/ui";
import { useState } from "react";
import { Download } from "lucide-react";
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
  Metric,
  Loading,
  ErrorBox,
  DataTable,
  DateFilters,
} from "../../components/ui";

type Row = { id: string } & Record<string, unknown>;

export function ReportsPage() {
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
      ["employeeCode", "Mã nhân viên"],
      ["name", "Họ tên"],
      ["departmentId", "Phòng ban"],
      ["positionId", "Chức danh"],
      ["status", "Trạng thái"],
    ],
    attendance: [
      ["employeeName", "Nhân viên"],
      ["date", "Ngày"],
      ["checkIn", "Giờ vào"],
      ["checkOut", "Giờ ra"],
      ["presenceMinutes", "Phút hiện diện"],
      ["paidMinutes", "Phút tính công"],
      ["status", "Trạng thái"],
    ],
    leave: [
      ["employeeName", "Nhân viên"],
      ["typeName", "Loại phép"],
      ["startDate", "Từ ngày"],
      ["endDate", "Đến ngày"],
      ["days", "Số ngày"],
      ["status", "Trạng thái"],
    ],
    balances: [
      ["employeeName", "Nhân viên"],
      ["year", "Năm"],
      ["allowance", "Hạn mức"],
      ["used", "Đã duyệt"],
      ["pending", "Chờ duyệt"],
      ["available", "Khả dụng"],
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
    if (key === "status") return labels[String(value)] || String(value);
    return String(value);
  }
  const statuses: Record<string, string[]> = {
    employees: ["active", "probation", "terminated"],
    attendance: ["on_time", "late", "missing_checkout", "working"],
    leave: ["pending", "approved", "rejected", "cancelled"],
    balances: [],
  };
  return (
    <>
      <Heading
        title="Báo cáo nhân sự"
        description="Tổng hợp dữ liệu thực tế trong phạm vi quyền truy cập của bạn."
        action={
          <Button
            variant="secondary"
            busy={exporting}
            onClick={() => void download()}
          >
            <Download size={16} />
            Xuất CSV
          </Button>
        }
      />
      <div className="tabs" role="tablist" aria-label="Loại báo cáo">
        {[
          ["employees", "Nhân viên"],
          ["attendance", "Chấm công"],
          ["leave", "Nghỉ phép"],
          ["balances", "Số dư phép"],
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
            Năm
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
          aria-label="Phòng ban"
          value={filters.departmentId}
          onValueChange={(value) =>
            setFilters({ ...filters, departmentId: value, page: 1 })
          }
          options={[
            { value: "", label: "Tất cả phòng ban" },
            ...(departments.data?.items.map((item) => ({
              value: item.id,
              label: item.name,
            })) ?? []),
          ]}
        />
        <Select
          aria-label="Nhân viên"
          value={filters.employeeId}
          onValueChange={(value) =>
            setFilters({ ...filters, employeeId: value, page: 1 })
          }
          options={[
            { value: "", label: "Tất cả nhân viên" },
            ...(staff.data?.items.map((item) => ({
              value: item.id,
              label: item.name,
            })) ?? []),
          ]}
        />
        {statuses[kind].length > 0 && (
          <Select
            aria-label="Trạng thái"
            value={filters.status}
            onValueChange={(value) =>
              setFilters({ ...filters, status: value, page: 1 })
            }
            options={[
              { value: "", label: "Tất cả trạng thái" },
              ...statuses[kind].map((status) => ({
                value: status,
                label: labels[status],
              })),
            ]}
          />
        )}
      </div>
      <ErrorBox error={q.error || error} />
      <div className="report-summary">
        <Metric
          label="Kết quả sau bộ lọc"
          value={q.data?.summary.total ?? "—"}
          note="Dữ liệu thuộc phạm vi của tài khoản"
        />
        <p>
          CSV xuất <strong>toàn bộ kết quả đã lọc</strong>, tối đa 5.000 dòng.
          Dữ liệu chấm công là bản tổng hợp, không phải bảng lương được xác
          nhận.
        </p>
      </div>
      {q.isPending ? (
        <Loading />
      ) : (
        <DataTable
          data={q.data}
          filtered
          onPage={(page) => setFilters({ ...filters, page })}
          columns={keys[kind].map(([key, label]) => ({
            label,
            render: (r: Row) => display(key, r[key]),
          }))}
        />
      )}
    </>
  );
}
