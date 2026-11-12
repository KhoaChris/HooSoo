import { DialogLink } from "../../components/navigation/dialog-link";
import { PersonCell } from "../../components/ui/person-cell";
import { Input, Button } from "../../components/ui";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, CalendarDays, ArrowUpRight } from "lucide-react";
import {
  type Page,
  type LeaveView,
  type BalanceView,
  type EmployeeView,
} from "@hoosoo/shared";
import { useApi } from "../../hooks/data";
import { queryString } from "../../services/api-client";
import { useCatalogs } from "../../hooks/catalogs";
import { today, dateText } from "../../utils/date-time";
import {
  Heading,
  Select,
  Metric,
  ErrorBox,
  DataTable,
  Badge,
  DateFilters,
} from "../../components/ui";

export function LeaveListPage({ personal = false }: { personal?: boolean }) {
  const [filters, setFilters] = useState({
    page: 1,
    status: "",
    startDate: "",
    endDate: "",
    departmentId: "",
    employeeId: "",
  });
  const [year, setYear] = useState(Number(today().slice(0, 4)));
  const q = useApi<Page<LeaveView>>(
      "/leave-requests" +
        queryString({
          ...filters,
          mine: personal ? "true" : undefined,
          approvals: personal ? undefined : "true",
        }),
    ),
    balances = useApi<Page<BalanceView>>(
      "/leave-balances?mine=true&year=" + year,
      personal,
    );
  const { departments } = useCatalogs();
  const staff = useApi<Page<EmployeeView>>(
    "/employees?pageSize=100",
    !personal,
  );
  const b = balances.data?.items[0];
  return (
    <>
      <Heading
        title={personal ? "Nghỉ phép của tôi" : "Duyệt nghỉ phép"}
        description={
          personal
            ? "Theo dõi quỹ phép, yêu cầu và lịch sử xử lý."
            : "Chỉ hiển thị các yêu cầu thuộc quyền xử lý của bạn."
        }
        action={
          <DialogLink className="button primary" to="/leave/new">
            <Plus size={17} />
            Tạo đơn nghỉ phép
          </DialogLink>
        }
      />
      {personal && (
        <>
          <label className="filter-label year-filter">
            Năm phép
            <Input
              aria-label="Năm phép"
              type="number"
              min="2020"
              max="2100"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </label>
          <ErrorBox error={balances.error} />
          <div className="metrics">
            <Metric
              label="Hạn mức"
              value={b?.allowance ?? "—"}
              note="Số ngày theo chính sách hiện hành"
            />
            <Metric
              label="Đã sử dụng / cam kết"
              value={b?.used ?? "—"}
              note="Gồm tất cả đơn được duyệt trong năm"
            />
            <Metric
              label="Đang chờ duyệt"
              value={b?.pending ?? "—"}
              note="Chưa trừ khỏi số khả dụng"
            />
            <Metric
              label="Còn khả dụng"
              value={b?.available ?? "—"}
              note="Hạn mức trừ số đã duyệt"
              accent
            />
          </div>
        </>
      )}
      <DataTable
        title={personal ? "Đơn nghỉ phép của tôi" : "Danh sách yêu cầu"}
        icon={<CalendarDays size={18} />}
        loading={q.isPending}
        error={q.error}
        onRetry={() => void q.refetch()}
        toolbar={
          <div className="filters">
            <DateFilters
              start={filters.startDate}
              end={filters.endDate}
              onChange={(startDate, endDate) =>
                setFilters({ ...filters, startDate, endDate, page: 1 })
              }
            />
            <Select
              aria-label="Trạng thái nghỉ phép"
              value={filters.status}
              onValueChange={(value) =>
                setFilters({ ...filters, status: value, page: 1 })
              }
              options={[
                { value: "", label: "Tất cả trạng thái" },
                { value: "pending", label: "Chờ duyệt" },
                { value: "approved", label: "Đã duyệt" },
                { value: "rejected", label: "Từ chối" },
                { value: "cancelled", label: "Đã hủy" },
              ]}
            />
            {!personal && (
              <>
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
              </>
            )}
            {(filters.status ||
              filters.startDate ||
              filters.endDate ||
              filters.departmentId ||
              filters.employeeId) && (
              <Button
                variant="ghost"
                className="filter-reset"
                onClick={() =>
                  setFilters({
                    page: 1,
                    status: "",
                    startDate: "",
                    endDate: "",
                    departmentId: "",
                    employeeId: "",
                  })
                }
              >
                Đặt lại
              </Button>
            )}
          </div>
        }
        data={q.data}
        filtered
        onPage={(page) => setFilters({ ...filters, page })}
        columns={[
          {
            label: "Nhân viên",
            render: (r) => (
              <PersonCell
                name={r.employeeName}
                detail={r.employeeCode}
                to={"/leave/" + r.id}
              />
            ),
          },
          { label: "Loại phép", render: (r) => r.typeName },
          {
            label: "Thời gian",
            render: (r) => (
              <>
                {dateText(r.startDate)} – {dateText(r.endDate)}
              </>
            ),
          },
          {
            label: "Số ngày",
            className: "cell-number",
            align: "center",
            render: (r) => (
              <span className="cell-duration">
                {r.days} <small>ngày</small>
              </span>
            ),
          },
          { label: "Trạng thái", render: (r) => <Badge value={r.status} /> },
          {
            label: "Chi tiết",
            className: "cell-actions",
            render: (r) => (
              <Link className="table-row-link" to={"/leave/" + r.id}>
                Xem đơn <ArrowUpRight size={14} />
              </Link>
            ),
          },
        ]}
      />{" "}
      {personal && b && (
        <section className="panel">
          <h2>Biến động số dư phép</h2>
          <p className="muted-note">
            Đơn đang chờ duyệt chỉ được theo dõi, không giữ chỗ số dư. Số dư
            được kiểm tra lại khi duyệt.
          </p>
          {b.transactions.length ? (
            b.transactions.map((t) => (
              <div className="balance-entry" key={t.id}>
                <div>
                  <strong>{t.reason}</strong>
                  <small>{dateText(t.createdAt)}</small>
                </div>
                <strong className={t.amount > 0 ? "teal" : "muted"}>
                  {t.amount > 0 ? "+" : ""}
                  {t.amount} ngày
                </strong>
              </div>
            ))
          ) : (
            <p>Chưa có biến động được ghi nhận.</p>
          )}
        </section>
      )}
    </>
  );
}
