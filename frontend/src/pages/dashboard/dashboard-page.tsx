import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Clock,
  Users,
} from "lucide-react";
import { useState } from "react";
import type { LeaveView, AttendanceView, BalanceView } from "@hoosoo/shared";
import { useAuth } from "../../app/auth";
import { useApi } from "../../hooks/data";
import { queryString } from "../../services/api-client";
import { today, dateText } from "../../utils/date-time";
import {
  Heading,
  Metric,
  Loading,
  ErrorBox,
  Badge,
  DateFilters,
  Empty,
} from "../../components/ui";

interface Dashboard {
  scope: string;
  asOf: string;
  employeeCount: number;
  departmentCount: number;
  todayAttendance: number;
  pendingLeaves: number;
  newHires: number;
  departments: { id: string; name: string; count: number }[];
  recentLeaves: LeaveView[];
  today: AttendanceView[];
  balances: BalanceView[];
}

export function DashboardPage() {
  const { me } = useAuth();
  const [range, setRange] = useState({
    start: today().slice(0, 8) + "01",
    end:
      today().slice(0, 8) +
      new Date(
        Number(today().slice(0, 4)),
        Number(today().slice(5, 7)),
        0,
      ).getDate(),
  });
  const q = useApi<Dashboard>(
    "/dashboard" + queryString({ startDate: range.start, endDate: range.end }),
  );
  if (q.isPending) return <Loading />;
  if (q.error)
    return <ErrorBox error={q.error} retry={() => void q.refetch()} />;
  const d = q.data!;
  return (
    <>
      <Heading
        title={`Chào ${me!.employee.name.split(" ").slice(-1)[0]}, một ngày tốt lành!`}
        description={`Cùng theo dõi đội ngũ và công việc hôm nay · ${dateText(today())}`}
        action={
          <Link className="button secondary" to="/attendance/my">
            <Clock size={17} />
            Chấm công hôm nay
          </Link>
        }
      />
      <div className="overview-strip">
        <div>
          <span className="status-dot" />
          <strong>{d.scope}</strong>
          <small>Cập nhật {new Date(d.asOf).toLocaleTimeString("vi-VN")}</small>
        </div>
        <div className="date-filter">
          <DateFilters
            start={range.start}
            end={range.end}
            onChange={(start, end) => setRange({ start, end })}
          />
        </div>
      </div>
      <div className="metrics">
        <Metric
          label={
            me!.actor.role === "Employee"
              ? "Phép năm còn khả dụng"
              : "Nhân viên đang làm việc"
          }
          value={
            me!.actor.role === "Employee"
              ? d.balances[0]?.available || 0
              : d.employeeCount
          }
          note={
            me!.actor.role === "Employee"
              ? "Không trừ trước đơn đang chờ duyệt"
              : "Trong phạm vi được phân quyền"
          }
          accent
        />
        <Metric
          label="Đã chấm công hôm nay"
          value={d.todayAttendance}
          note="Không suy ra vắng mặt từ dữ liệu trống"
        />
        <Metric
          label="Đơn nghỉ đang chờ duyệt"
          value={d.pendingLeaves}
          note="Theo khoảng ngày đã chọn"
        />
        <Metric
          label={
            me!.actor.role === "Employee" ? "Phép đã sử dụng" : "Nhân viên mới"
          }
          value={
            me!.actor.role === "Employee"
              ? d.balances[0]?.used || 0
              : d.newHires
          }
          note={
            me!.actor.role === "Employee"
              ? "Số ngày được duyệt trong năm"
              : "Ngày vào làm trong khoảng đã chọn"
          }
        />
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Đội ngũ theo phòng ban</h2>
              <p>Nhân viên đang làm việc trong phạm vi của bạn</p>
            </div>
            <Users size={20} />
          </div>
          <div className="department-bars">
            {d.departments
              .filter((x) => x.count > 0)
              .map((dep, i) => (
                <div className="department-bar" key={dep.id}>
                  <span className="dep-number">0{i + 1}</span>
                  <div>
                    <div className="bar-label">
                      <strong>{dep.name}</strong>
                      <span>{dep.count} nhân viên</span>
                    </div>
                    <div className="bar-track">
                      <div
                        style={{
                          width:
                            Math.max(
                              5,
                              (dep.count /
                                Math.max(
                                  ...d.departments.map((d) => d.count),
                                )) *
                                100,
                            ) + "%",
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
          </div>
          <Link className="panel-link" to="/organization">
            Khám phá sơ đồ tổ chức
            <ArrowUpRight size={16} />
          </Link>
        </section>
        <section className="panel personal-panel">
          <span className="eyebrow">KHÔNG GIAN CỦA BẠN</span>
          <h2>
            Công việc hằng ngày,
            <br />
            trong tầm tay.
          </h2>
          <p>Chủ động theo dõi thời gian làm việc và các yêu cầu của mình.</p>
          <Link to="/attendance/my">
            <Clock size={19} />
            <span>Chấm công & lịch sử</span>
            <ArrowRight size={16} />
          </Link>
          <Link to="/leave/new">
            <CalendarDays size={19} />
            <span>Tạo yêu cầu nghỉ phép</span>
            <ArrowRight size={16} />
          </Link>
          <div className="personal-balance">
            <span>Quỹ phép năm {today().slice(0, 4)}</span>
            <strong>
              {d.balances[0]?.available || 0}
              <small> ngày còn lại</small>
            </strong>
          </div>
        </section>
      </div>
      <section className="panel recent-panel">
        <div className="section-heading">
          <div>
            <h2>Yêu cầu nghỉ phép gần đây</h2>
            <p>Theo phạm vi và khoảng ngày đã chọn</p>
          </div>
          <Link
            className="text-link"
            to={
              me!.actor.role === "Employee" ? "/leave/my" : "/leave/approvals"
            }
          >
            Xem danh sách
            <ArrowRight size={16} />
          </Link>
        </div>
        {d.recentLeaves.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Nhân viên</th>
                  <th>Loại nghỉ</th>
                  <th>Thời gian</th>
                  <th>Số ngày</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {d.recentLeaves.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <Link to={"/leave/" + l.id}>{l.employeeName}</Link>
                    </td>
                    <td>{l.typeName}</td>
                    <td>
                      {dateText(l.startDate)} – {dateText(l.endDate)}
                    </td>
                    <td>{l.days}</td>
                    <td>
                      <Badge value={l.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty filtered />
        )}
      </section>
    </>
  );
}
