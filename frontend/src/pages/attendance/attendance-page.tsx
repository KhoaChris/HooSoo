import { t, useLocale } from "../../i18n";
import { PersonCell } from "../../components/ui/person-cell";
import { useState } from "react";
import { Clock, LogIn, LogOut, Pencil, History } from "lucide-react";
import { z } from "zod";
import type { AttendanceView, Page, EmployeeView } from "@hoosoo/shared";
import { useAuth } from "../../app/auth";
import { useApi, useAction } from "../../hooks/data";
import { queryString } from "../../services/api-client";
import { useCatalogs } from "../../hooks/catalogs";
import { today, dateText, timeText } from "../../utils/date-time";
import {
  Heading,
  Select,
  Button,
  Metric,
  ErrorBox,
  DataTable,
  Badge,
  DateFilters,
  Form,
  Modal,
} from "../../components/ui";

const minutes = (v: number | null) =>
  v === null
    ? t("Chưa đủ dữ liệu")
    : t("{0} giờ {1} phút", [Math.floor(v / 60), Math.round(v % 60)]);

function localInput(iso: string | null) {
  if (!iso) return "";
  return new Date(Date.parse(iso) + 7 * 3600000).toISOString().slice(0, 16);
}

export function AttendancePage({ personal = false }: { personal?: boolean }) {
  useLocale();
  const { me } = useAuth();
  const [filters, setFilters] = useState({
    page: 1,
    startDate: today().slice(0, 8) + "01",
    endDate: today(),
    departmentId: "",
    employeeId: "",
    status: "",
  });
  const [edit, setEdit] = useState<AttendanceView | null>(null),
    [history, setHistory] = useState<AttendanceView | null>(null);
  const q = useApi<Page<AttendanceView>>(
      "/attendance" +
        queryString({ ...filters, mine: personal ? "true" : undefined }),
    ),
    current = useApi<AttendanceView | null>("/attendance/today", personal),
    action = useAction();
  const { departments } = useCatalogs();
  const staff = useApi<Page<EmployeeView>>(
    "/employees?pageSize=100",
    !personal,
  );
  const canEdit = ["Admin", "HR"].includes(me!.actor.role) && !personal;
  const row = current.data;
  return (
    <>
      <Heading
        title={personal ? t("Chấm công của tôi") : t("Bảng chấm công")}
      />
      {personal && (
        <>
          <section className="checkin-panel">
            <div className="checkin-title">
              <span className="clock-icon">
                <Clock size={26} />
              </span>
              <div>
                <h2>
                  {t("Hôm nay,")} {dateText(today())}
                </h2>
                <p>
                  {row
                    ? row.checkOut
                      ? t("Đã kết thúc ca.")
                      : t("Đang trong ca.")
                    : t("Chưa vào ca.")}
                </p>
              </div>
            </div>
            <div className="checkin-times">
              <div>
                <span>{t("Giờ vào")}</span>
                <strong>{timeText(row?.checkIn)}</strong>
              </div>
              <div>
                <span>{t("Giờ ra")}</span>
                <strong>{timeText(row?.checkOut)}</strong>
              </div>
            </div>
            <div className="row-actions">
              <Button
                busy={action.isPending}
                disabled={!!row || current.isPending || !!current.error}
                onClick={() => action.mutate({ path: "/attendance/check-in" })}
              >
                <LogIn size={17} />
                {t("Vào ca")}
              </Button>
              <Button
                variant="secondary"
                busy={action.isPending}
                disabled={!row || !!row.checkOut || !!current.error}
                onClick={() => action.mutate({ path: "/attendance/check-out" })}
              >
                <LogOut size={17} />
                {t("Kết thúc ca")}
              </Button>
            </div>
          </section>
          <ErrorBox error={action.error || current.error} />
          {row?.leaveConflict && (
            <p className="notice">
              {t("Trùng ngày nghỉ đã duyệt. Liên hệ nhân sự.")}
            </p>
          )}
          <div className="metrics two">
            <Metric
              label={t("Thời gian hiện diện")}
              value={
                row?.presenceMinutes == null
                  ? null
                  : minutes(row.presenceMinutes)
              }
              emptyLabel={t("Chưa đủ dữ liệu")}
            />
            <Metric
              label={t("Thời gian tính công trong ca")}
              value={row?.paidMinutes == null ? null : minutes(row.paidMinutes)}
              emptyLabel={t("Chưa đủ dữ liệu")}
            />
          </div>
        </>
      )}
      <DataTable
        title={personal ? t("Lịch sử chấm công") : t("Dữ liệu chấm công")}
        icon={<Clock size={18} />}
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
            {!personal && (
              <>
                <Select
                  aria-label={t("Lọc phòng ban")}
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
                  aria-label={t("Lọc nhân viên")}
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
              </>
            )}
            <Select
              aria-label={t("Lọc trạng thái chấm công")}
              value={filters.status}
              onValueChange={(value) =>
                setFilters({ ...filters, status: value, page: 1 })
              }
              options={[
                { value: "", label: t("Tất cả trạng thái") },
                { value: "on_time", label: t("Đúng giờ") },
                { value: "late", label: t("Đi muộn") },
                { value: "missing_checkout", label: t("Thiếu giờ ra") },
                { value: "working", label: t("Đang làm việc") },
              ]}
            />
            {(filters.departmentId ||
              filters.employeeId ||
              filters.status ||
              filters.startDate !== today().slice(0, 8) + "01" ||
              filters.endDate !== today()) && (
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
                  })
                }
              >
                {t("Đặt lại")}
              </Button>
            )}
          </div>
        }
        data={q.data}
        filtered
        onPage={(page) => setFilters({ ...filters, page })}
        columns={[
          ...(!personal
            ? [
                {
                  minWidth: 240,
                  label: t("Nhân viên"),
                  render: (r: AttendanceView) => (
                    <PersonCell
                      name={r.employeeName}
                      detail={r.employeeCode}
                      avatarUrl={
                        personal
                          ? me?.employee.avatarUrl
                          : staff.data?.items.find((e) => e.id === r.employeeId)
                              ?.avatarUrl
                      }
                    />
                  ),
                },
              ]
            : []),
          {
            minWidth: 150,
            label: t("Ngày làm việc"),
            render: (r) => dateText(r.date),
          },
          {
            minWidth: 150,
            label: t("Giờ vào / ra"),
            render: (r) => (
              <div className="attendance-time-cell">
                <span>
                  <small>{t("Vào")}</small>
                  <strong>{timeText(r.checkIn)}</strong>
                </span>
                <span>
                  <small>{t("Ra")}</small>
                  <strong>{timeText(r.checkOut)}</strong>
                </span>
              </div>
            ),
          },
          {
            minWidth: 150,
            label: t("Hiện diện"),
            render: (r) => minutes(r.presenceMinutes),
          },
          {
            minWidth: 150,
            label: t("Tính công"),
            className: "cell-number",
            render: (r) => (
              <span className="cell-duration">{minutes(r.paidMinutes)}</span>
            ),
          },
          {
            minWidth: 180,
            label: t("Trạng thái"),
            render: (r) => (
              <>
                <Badge value={r.status} />
                {r.late && r.status !== "late" && <Badge value="late" />}
                {r.leaveConflict && (
                  <small className="warning-text">
                    {t("Trùng ngày nghỉ đã duyệt")}
                  </small>
                )}
              </>
            ),
          },
          {
            minWidth: personal ? 160 : 280,
            label: t("Thao tác"),
            className: "cell-actions",
            render: (r) => (
              <div className="row-actions">
                {canEdit && r.canAdjust && (
                  <Button variant="ghost" onClick={() => setEdit(r)}>
                    <Pencil size={15} />
                    {t("Điều chỉnh")}
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setHistory(r)}>
                  <History size={15} />
                  {t("Lịch sử")}
                </Button>
              </div>
            ),
          },
        ]}
      />{" "}
      {edit && (
        <Modal
          title={t("Điều chỉnh chấm công")}
          description={
            edit.employeeName +
            " · " +
            dateText(edit.date) +
            t(" · Giờ Việt Nam")
          }
          icon={<Clock size={21} />}
          onClose={() => setEdit(null)}
        >
          <Form
            schema={z
              .object({
                checkIn: z.string().min(1),
                checkOut: z.string(),
                reason: z.string().trim().min(5),
              })
              .transform((v) => ({
                ...v,
                checkIn: new Date(v.checkIn + ":00+07:00").toISOString(),
                checkOut: v.checkOut
                  ? new Date(v.checkOut + ":00+07:00").toISOString()
                  : null,
              }))}
            defaults={{
              checkIn: localInput(edit.checkIn),
              checkOut: localInput(edit.checkOut),
              reason: "",
            }}
            fields={[
              { name: "checkIn", label: t("Giờ vào"), type: "datetime-local" },
              {
                name: "checkOut",
                label: t("Giờ ra"),
                type: "datetime-local",
                hint: t("Bỏ trống nếu chưa có giờ ra."),
              },
              {
                name: "reason",
                label: t("Lý do điều chỉnh"),
                type: "textarea",
              },
            ]}
            onSubmit={async (body) => {
              await action.mutateAsync({
                path: "/attendance/" + edit.id + "/adjustment",
                method: "PATCH",
                body,
              });
              setEdit(null);
            }}
            onCancel={() => setEdit(null)}
          />
        </Modal>
      )}
      {history && (
        <Modal
          title={t("Lịch sử điều chỉnh chấm công")}
          description={history.employeeName + " · " + dateText(history.date)}
          icon={<History size={21} />}
          onClose={() => setHistory(null)}
        >
          {history.adjustments.length ? (
            history.adjustments.map((h, i) => (
              <div className="history-entry" key={i}>
                <strong>{h.reason}</strong>
                <p>
                  {t("Trước:")} {timeText(h.before.checkIn)} →{" "}
                  {timeText(h.before.checkOut)}
                </p>
                <p>
                  Sau: {timeText(h.after.checkIn)} →{" "}
                  {timeText(h.after.checkOut)}
                </p>
                <small>
                  {dateText(h.at)} · {timeText(h.at)}
                </small>
              </div>
            ))
          ) : (
            <p>{t("Chưa có điều chỉnh.")}</p>
          )}
        </Modal>
      )}
    </>
  );
}
