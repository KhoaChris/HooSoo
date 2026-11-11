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
  Loading,
  ErrorBox,
  DataTable,
  Badge,
  DateFilters,
  Form,
  Modal,
} from "../../components/ui";

const minutes = (v: number | null) =>
  v === null
    ? "Chưa đủ dữ liệu"
    : `${Math.floor(v / 60)} giờ ${Math.round(v % 60)} phút`;

function localInput(iso: string | null) {
  if (!iso) return "";
  return new Date(Date.parse(iso) + 7 * 3600000).toISOString().slice(0, 16);
}

export function AttendancePage({ personal = false }: { personal?: boolean }) {
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
        title={personal ? "Chấm công của tôi" : "Bảng chấm công"}
        description="Thời gian theo múi giờ Việt Nam · Một ca làm việc trong ngày."
      />
      {personal && (
        <>
          <section className="checkin-panel">
            <div className="checkin-title">
              <span className="clock-icon">
                <Clock size={26} />
              </span>
              <div>
                <h2>Hôm nay, {dateText(today())}</h2>
                <p>
                  {row
                    ? row.checkOut
                      ? "Bạn đã kết thúc ca hôm nay."
                      : "Bạn đang trong ca làm việc."
                    : "Bắt đầu ngày làm việc bằng một lần chấm công."}
                </p>
              </div>
            </div>
            <div className="checkin-times">
              <div>
                <span>Giờ vào</span>
                <strong>{timeText(row?.checkIn)}</strong>
              </div>
              <div>
                <span>Giờ ra</span>
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
                Vào ca
              </Button>
              <Button
                variant="secondary"
                busy={action.isPending}
                disabled={!row || !!row.checkOut || !!current.error}
                onClick={() => action.mutate({ path: "/attendance/check-out" })}
              >
                <LogOut size={17} />
                Kết thúc ca
              </Button>
            </div>
          </section>
          <ErrorBox error={action.error || current.error} />
          {row?.leaveConflict && (
            <p className="notice">
              Chấm công hôm nay trùng ngày nghỉ đã được duyệt. Vui lòng liên hệ
              nhân sự.
            </p>
          )}
          <div className="metrics two">
            <Metric
              label="Thời gian hiện diện"
              value={minutes(row?.presenceMinutes ?? null)}
            />
            <Metric
              label="Thời gian tính công trong ca"
              value={minutes(row?.paidMinutes ?? null)}
              note="Chỉ trừ phần nghỉ giữa ca giao với thời gian thực tế"
            />
          </div>
          <p className="muted-note">
            Chấm công web phục vụ minh họa, không xác thực vị trí làm việc. Hệ
            thống sử dụng thời gian máy chủ.
          </p>
        </>
      )}
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
              aria-label="Lọc phòng ban"
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
              aria-label="Lọc nhân viên"
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
        <Select
          aria-label="Lọc trạng thái chấm công"
          value={filters.status}
          onValueChange={(value) =>
            setFilters({ ...filters, status: value, page: 1 })
          }
          options={[
            { value: "", label: "Tất cả trạng thái" },
            { value: "on_time", label: "Đúng giờ" },
            { value: "late", label: "Đi muộn" },
            { value: "missing_checkout", label: "Thiếu giờ ra" },
            { value: "working", label: "Đang làm việc" },
          ]}
        />
      </div>
      <ErrorBox error={q.error} />
      {q.isPending ? (
        <Loading />
      ) : (
        <DataTable
          data={q.data}
          filtered
          onPage={(page) => setFilters({ ...filters, page })}
          columns={[
            ...(!personal
              ? [
                  {
                    label: "Nhân viên",
                    render: (r: AttendanceView) => (
                      <strong>{r.employeeName}</strong>
                    ),
                  },
                ]
              : []),
            { label: "Ngày làm việc", render: (r) => dateText(r.date) },
            {
              label: "Giờ vào / ra",
              render: (r) => (
                <>
                  {timeText(r.checkIn)} <span className="muted">→</span>{" "}
                  {timeText(r.checkOut)}
                </>
              ),
            },
            { label: "Hiện diện", render: (r) => minutes(r.presenceMinutes) },
            { label: "Tính công", render: (r) => minutes(r.paidMinutes) },
            {
              label: "Trạng thái",
              render: (r) => (
                <>
                  <Badge value={r.status} />
                  {r.late && r.status !== "late" && <Badge value="late" />}
                  {r.leaveConflict && (
                    <small className="warning-text">
                      Trùng ngày nghỉ đã duyệt
                    </small>
                  )}
                </>
              ),
            },
            {
              label: "Thao tác",
              render: (r) => (
                <div className="row-actions">
                  {canEdit && (
                    <Button variant="ghost" onClick={() => setEdit(r)}>
                      <Pencil size={15} />
                      Điều chỉnh
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => setHistory(r)}>
                    <History size={15} />
                    Lịch sử
                  </Button>
                </div>
              ),
            },
          ]}
        />
      )}{" "}
      {edit && (
        <Modal
          title={"Điều chỉnh chấm công · " + edit.employeeName}
          onClose={() => setEdit(null)}
        >
          <p>Ngày {dateText(edit.date)}. Giờ nhập theo múi giờ Việt Nam.</p>
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
              { name: "checkIn", label: "Giờ vào", type: "datetime-local" },
              {
                name: "checkOut",
                label: "Giờ ra",
                type: "datetime-local",
                hint: "Để trống nếu chưa xác minh được giờ ra.",
              },
              { name: "reason", label: "Lý do điều chỉnh", type: "textarea" },
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
          title="Lịch sử điều chỉnh chấm công"
          onClose={() => setHistory(null)}
        >
          {history.adjustments.length ? (
            history.adjustments.map((h, i) => (
              <div className="history-entry" key={i}>
                <strong>{h.reason}</strong>
                <p>
                  Trước: {timeText(h.before.checkIn)} →{" "}
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
            <p>
              Chưa có điều chỉnh nào. Bản ghi được tạo từ thao tác chấm công.
            </p>
          )}
        </Modal>
      )}
    </>
  );
}
