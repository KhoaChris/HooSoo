import { StableText } from "../../i18n/stable-text";
import { t as translate, useLocale } from "../../i18n";
import { useAuth } from "../../app/auth";
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
  useLocale();
  const { me } = useAuth();
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
        title={
          personal
            ? translate("Nghỉ phép của tôi")
            : translate("Duyệt nghỉ phép")
        }
        action={
          personal ? (
            <DialogLink className="button primary" to="/leave/new">
              <Plus size={17} />
              {translate("Tạo đơn nghỉ phép")}
            </DialogLink>
          ) : undefined
        }
      />
      {personal && (
        <>
          <label className="filter-label year-filter">
            {translate("Năm phép")}
            <Input
              aria-label={translate("Năm phép")}
              type="number"
              min="2020"
              max="2100"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </label>
          <ErrorBox error={balances.error} />
          <div className="metrics">
            <Metric label={translate("Hạn mức")} value={b?.allowance ?? "—"} />
            <Metric
              label={translate("Đã sử dụng / cam kết")}
              value={b?.used ?? "—"}
            />
            <Metric
              label={translate("Đang chờ duyệt")}
              value={b?.pending ?? "—"}
            />
            <Metric
              label={translate("Còn khả dụng")}
              value={b?.available ?? "—"}
              accent
            />
          </div>
        </>
      )}
      <DataTable
        title={
          personal
            ? translate("Đơn nghỉ phép của tôi")
            : translate("Danh sách yêu cầu")
        }
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
              aria-label={translate("Trạng thái nghỉ phép")}
              value={filters.status}
              onValueChange={(value) =>
                setFilters({ ...filters, status: value, page: 1 })
              }
              options={[
                { value: "", label: translate("Tất cả trạng thái") },
                { value: "pending", label: translate("Chờ duyệt") },
                { value: "approved", label: translate("Đã duyệt") },
                { value: "rejected", label: translate("Từ chối") },
                { value: "cancelled", label: translate("Đã hủy") },
              ]}
            />
            {!personal && (
              <>
                <Select
                  aria-label={translate("Phòng ban")}
                  value={filters.departmentId}
                  onValueChange={(value) =>
                    setFilters({ ...filters, departmentId: value, page: 1 })
                  }
                  options={[
                    { value: "", label: translate("Tất cả phòng ban") },
                    ...(departments.data?.items.map((item) => ({
                      value: item.id,
                      label: item.name,
                    })) ?? []),
                  ]}
                />
                <Select
                  aria-label={translate("Nhân viên")}
                  value={filters.employeeId}
                  onValueChange={(value) =>
                    setFilters({ ...filters, employeeId: value, page: 1 })
                  }
                  options={[
                    { value: "", label: translate("Tất cả nhân viên") },
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
                {translate("Đặt lại")}
              </Button>
            )}
          </div>
        }
        data={q.data}
        filtered
        onPage={(page) => setFilters({ ...filters, page })}
        columns={[
          {
            minWidth: 250,
            label: translate("Nhân viên"),
            render: (r) => (
              <PersonCell
                name={r.employeeName}
                avatarUrl={
                  personal
                    ? me?.employee.avatarUrl
                    : staff.data?.items.find((e) => e.id === r.employeeId)
                        ?.avatarUrl
                }
                detail={r.employeeCode}
                to={"/leave/" + r.id}
              />
            ),
          },
          {
            minWidth: 205,
            label: translate("Loại phép"),
            render: (r) => r.typeName,
          },
          {
            minWidth: 215,
            label: translate("Thời gian"),
            render: (r) => (
              <>
                {dateText(r.startDate)} – {dateText(r.endDate)}
              </>
            ),
          },
          {
            minWidth: 110,
            label: translate("Số ngày"),
            className: "cell-number",
            align: "center",
            render: (r) => (
              <span className="cell-duration">
                {r.days} <small> {translate("ngày")}</small>
              </span>
            ),
          },
          {
            minWidth: 180,
            label: translate("Trạng thái"),
            render: (r) => <Badge value={r.status} />,
          },
          {
            minWidth: 180,
            label: translate("Chi tiết"),
            className: "cell-actions",
            render: (r) => (
              <Link className="table-row-link" to={"/leave/" + r.id}>
                <StableText>{translate("Xem đơn")}</StableText>{" "}
                <ArrowUpRight size={14} />
              </Link>
            ),
          },
        ]}
      />{" "}
      {personal && b && (
        <section className="panel">
          <h2>{translate("Biến động số dư phép")}</h2>
          {b.transactions.length ? (
            b.transactions.map((t) => (
              <div className="balance-entry" key={t.id}>
                <div>
                  <strong>{t.reason}</strong>
                  <small>{dateText(t.createdAt)}</small>
                </div>
                <strong className={t.amount > 0 ? "teal" : "muted"}>
                  {t.amount > 0 ? "+" : ""}
                  {t.amount} {translate("ngày")}
                </strong>
              </div>
            ))
          ) : (
            <p>{translate("Chưa có biến động được ghi nhận.")}</p>
          )}
        </section>
      )}
    </>
  );
}
