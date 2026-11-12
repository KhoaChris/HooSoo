import { DialogLink } from "../../components/navigation/dialog-link";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ClipboardCheck,
  Clock,
  Plus,
  Users,
} from "lucide-react";
import type { Me } from "@hoosoo/shared";
import { Badge } from "../../components/ui";
import { dateText, timeText, today } from "../../utils/date-time";
import type { DashboardData, DashboardRange } from "./dashboard-data";
import { DashboardRangeFilter } from "./dashboard-range";
import { DashboardPersonal } from "./dashboard-personal";

export function DashboardView({
  data: d,
  me,
  range,
  onRangeChange,
  refreshing = false,
}: {
  data: DashboardData;
  me: Me;
  range: DashboardRange;
  onRangeChange: (range: DashboardRange) => void;
  refreshing?: boolean;
}) {
  const personal = me.actor.role === "Employee";
  const leavePath = personal ? "/leave/my" : "/leave/approvals";
  const balance = d.balances.find(
    (item) => item.employeeId === me.actor.employeeId,
  );
  const attendance = d.today.find(
    (item) => item.employeeId === me.actor.employeeId && item.date === today(),
  );
  const departments = d.departments
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);
  const departmentTotal = departments.reduce(
    (total, item) => total + item.count,
    0,
  );
  const stats = personal
    ? [
        {
          label: "Phép còn lại",
          value: balance?.available ?? "—",
          note: "Ngày phép năm khả dụng",
          to: "/leave/my",
          accent: true,
        },
        {
          label: "Phép đã dùng",
          value: balance?.used ?? "—",
          note: "Ngày được duyệt trong năm",
          to: "/leave/my",
        },
        {
          label: "Đơn chờ duyệt",
          value: d.pendingLeaves,
          note: "Trong kỳ thống kê",
          to: leavePath,
        },
        {
          label: "Chấm công hôm nay",
          value: attendance?.checkOut
            ? "Đã xong"
            : attendance
              ? "Đã vào"
              : "Chưa vào",
          note: attendance
            ? `Giờ vào · ${timeText(attendance.checkIn)}`
            : "Chưa có bản ghi giờ vào",
          to: "/attendance/my",
        },
      ]
    : [
        {
          label: "Nhân viên hiện tại",
          value: d.employeeCount,
          note: "Trong phạm vi của bạn",
          to: "/employees",
          accent: true,
        },
        {
          label: "Chấm công hôm nay",
          value: d.todayAttendance,
          note: "Nhân viên đã có giờ vào",
          to: "/attendance",
        },
        {
          label: "Đơn chờ duyệt",
          value: d.pendingLeaves,
          note: "Trong kỳ thống kê",
          to: leavePath,
        },
        {
          label: "Nhân viên mới",
          value: d.newHires,
          note: "Vào làm trong kỳ thống kê",
          to: "/employees",
        },
      ];

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <p className="dashboard-context">
            {d.scope}
            <span aria-hidden="true">/</span>
            {dateText(today())}
          </p>
          <h1>{personal ? "Tổng quan cá nhân" : "Tổng quan nhân sự"}</h1>
          <p className="dashboard-greeting">
            Chào {me.employee.name.split(" ").at(-1)}, đây là tình hình hôm nay.
          </p>
        </div>
        <div className="dashboard-header-actions">
          <Link className="button secondary" to="/attendance/my">
            <Clock size={17} aria-hidden="true" />
            Chấm công
          </Link>
          <DialogLink
            className="button primary"
            to={personal ? "/leave/new" : leavePath}
          >
            {personal ? (
              <Plus size={17} aria-hidden="true" />
            ) : (
              <ClipboardCheck size={17} aria-hidden="true" />
            )}
            {personal ? "Tạo đơn nghỉ phép" : "Duyệt nghỉ phép"}
          </DialogLink>
        </div>
      </header>
      <DashboardRangeFilter range={range} onChange={onRangeChange} />
      <section className="dashboard-stats" aria-label="Số liệu tổng quan">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            to={stat.to}
            className={"dashboard-stat" + (stat.accent ? " is-accent" : "")}
          >
            <span className="dashboard-stat-label">
              {stat.label}
              <ArrowUpRight size={15} aria-hidden="true" />
            </span>
            <strong
              className={
                typeof stat.value === "string" && stat.value.length > 2
                  ? "is-text"
                  : undefined
              }
            >
              {stat.value}
            </strong>
            <span className="dashboard-stat-note">{stat.note}</span>
          </Link>
        ))}
      </section>
      <div className="dashboard-workspace">
        <div className="dashboard-primary">
          <section
            className="dashboard-requests"
            aria-labelledby="dashboard-requests-title"
          >
            <div className="dashboard-section-heading">
              <div>
                <h2 id="dashboard-requests-title">
                  {personal ? "Đơn nghỉ phép của bạn" : "Yêu cầu nghỉ phép"}
                </h2>
                <p className="dashboard-caption">
                  Tối đa 5 yêu cầu mới nhất trong kỳ thống kê
                </p>
              </div>
              <Link className="dashboard-text-link" to={leavePath}>
                Xem tất cả <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
            {d.recentLeaves.length ? (
              <>
                <div className="dashboard-request-columns" aria-hidden="true">
                  <span>{personal ? "Yêu cầu" : "Nhân viên / Loại nghỉ"}</span>
                  <span>Thời gian nghỉ</span>
                  <span>Số ngày</span>
                  <span>Trạng thái</span>
                </div>
                <ul className="dashboard-request-list">
                  {d.recentLeaves.map((leave) => (
                    <li key={leave.id}>
                      <Link
                        className="dashboard-request"
                        to={`/leave/${leave.id}`}
                      >
                        <span className="dashboard-request-person">
                          <span className="dashboard-avatar" aria-hidden="true">
                            {personal ? (
                              <CalendarDays size={18} />
                            ) : (
                              leave.employeeName
                                .trim()
                                .split(/\s+/)
                                .slice(-2)
                                .map((word) => word[0])
                                .join("")
                            )}
                          </span>
                          <span>
                            <strong>
                              {personal ? leave.typeName : leave.employeeName}
                            </strong>
                            <small>
                              {personal
                                ? `Mã đơn · ${leave.id.slice(0, 8)}`
                                : leave.typeName}
                            </small>
                          </span>
                        </span>
                        <span className="dashboard-request-dates">
                          {dateText(leave.startDate)}
                          {leave.endDate !== leave.startDate && (
                            <small>đến {dateText(leave.endDate)}</small>
                          )}
                        </span>
                        <span className="dashboard-request-days">
                          {leave.days}
                          <span> ngày</span>
                        </span>
                        <span className="dashboard-request-state">
                          <Badge value={leave.status} />
                          <ArrowUpRight size={14} aria-hidden="true" />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="dashboard-empty">
                <CalendarDays size={24} aria-hidden="true" />
                <h3>Chưa có yêu cầu trong khoảng này</h3>
                <p>Chọn kỳ thống kê khác để xem các yêu cầu trước đó.</p>
                {personal && (
                  <DialogLink className="dashboard-text-link" to="/leave/new">
                    Tạo đơn nghỉ phép{" "}
                    <ArrowRight size={15} aria-hidden="true" />
                  </DialogLink>
                )}
              </div>
            )}
          </section>
          {!personal && (
            <section
              className="dashboard-departments"
              aria-labelledby="dashboard-departments-title"
            >
              <div className="dashboard-section-heading">
                <div>
                  <h2 id="dashboard-departments-title">Phân bổ nhân sự</h2>
                  <p className="dashboard-caption">
                    Theo phòng ban · Trong phạm vi của bạn
                  </p>
                </div>
                <Link className="dashboard-text-link" to="/organization">
                  Sơ đồ tổ chức <ArrowUpRight size={15} aria-hidden="true" />
                </Link>
              </div>
              {departments.length ? (
                <ul className="dashboard-department-list">
                  {departments.map((department) => (
                    <li key={department.id}>
                      <div className="dashboard-department-label">
                        <strong>{department.name}</strong>
                        <span>
                          {department.count} <small>nhân viên</small>
                        </span>
                      </div>
                      <div
                        className="dashboard-department-track"
                        role="meter"
                        aria-label={department.name}
                        aria-valuemin={0}
                        aria-valuemax={departmentTotal}
                        aria-valuenow={department.count}
                        aria-valuetext={`${department.count} trên ${departmentTotal} nhân viên có phòng ban`}
                      >
                        <span
                          style={{
                            width: `${(department.count / departmentTotal) * 100}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="dashboard-empty is-compact">
                  <Users size={22} aria-hidden="true" />
                  <p>Chưa có nhân viên được phân vào phòng ban.</p>
                </div>
              )}
            </section>
          )}
        </div>
        <DashboardPersonal attendance={attendance} balance={balance} />
      </div>
      <div className="dashboard-updated" role="status">
        <Clock size={13} aria-hidden="true" />
        {refreshing
          ? "Đang cập nhật tổng quan…"
          : `Dữ liệu lúc ${timeText(d.asOf)} · ${dateText(d.asOf)}`}
      </div>
    </div>
  );
}
