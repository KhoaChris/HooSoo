import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  CalendarDays,
  ClipboardCheck,
  FileText,
  Inbox,
} from "lucide-react";
import { roleDefinitions, type Me } from "@hoosoo/shared";
import { t, useLocale } from "../../i18n";
import { dateText, today } from "../../utils/date-time";
import {
  dashboardRole,
  isOpenWork,
  isOverdueWork,
  pendingWorkflowCount,
} from "./dashboard-model";
import type {
  DashboardData,
  DashboardRange,
  DashboardResources,
} from "./dashboard-data";
import { DashboardRangeFilter } from "./dashboard-range";
import { DashboardPersonal } from "./dashboard-personal";
import {
  DashboardActivity,
  DashboardRecruitment,
  DashboardShortcuts,
  DashboardTeam,
  DashboardWork,
} from "./dashboard-sections";

export function DashboardView({
  data: d,
  me,
  range,
  onRangeChange,
  refreshing = false,
  resources: r,
}: {
  data: DashboardData;
  me: Me;
  range: DashboardRange;
  onRangeChange: (range: DashboardRange) => void;
  refreshing?: boolean;
  resources: DashboardResources;
}) {
  useLocale();
  const profile = dashboardRole(me.actor.role);
  const day = today();
  const balance = d.balances.find((b) => b.employeeId === me.actor.employeeId);
  const attendance = d.today.find(
    (a) => a.employeeId === me.actor.employeeId && a.date === day,
  );
  const work = r.work.error ? undefined : r.work.data?.items;
  const schedules = r.schedules.error ? undefined : r.schedules.data?.items;
  const requests = r.requests.error ? undefined : r.requests.data?.items;
  const jobs = r.recruitment.error
    ? undefined
    : r.recruitment.data?.items.filter((j) => j.active);
  const count = (value: number | undefined) => value ?? "—";
  const pendingSchedules =
    schedules && pendingWorkflowCount(schedules, profile.supervisor);
  const pendingRequests =
    requests && pendingWorkflowCount(requests, profile.supervisor);
  const pendingLeaves = profile.supervisor
    ? r.leaves.error
      ? undefined
      : r.leaves.data?.total
    : d.pendingLeaves;
  const queues = [
    {
      title: "Nghỉ phép",
      count: pendingLeaves,
      to: `/leave/${profile.supervisor ? "approvals" : "my"}`,
      icon: ClipboardCheck,
    },
    {
      title: "Lịch làm việc",
      count: pendingSchedules,
      to: `/work-schedule${profile.supervisor ? "/approvals" : ""}`,
      icon: CalendarDays,
    },
    {
      title: "Phiếu đề nghị",
      count: pendingRequests,
      to: `/requests/${profile.supervisor ? "approvals" : "my"}`,
      icon: FileText,
    },
  ];
  const stats =
    profile.focus === "organization" || profile.focus === "recruitment"
      ? [
          {
            label: "Nhân viên hiện tại",
            value: d.employeeCount,
            to: "/employees",
            note: "Trong phạm vi của bạn",
          },
          {
            label: "Chấm công hôm nay",
            value: d.todayAttendance,
            to: "/attendance",
            note: dateText(day),
          },
          {
            label: "Nhân viên mới",
            value: d.newHires,
            to: "/employees",
            note: "Trong kỳ thống kê",
          },
          {
            label: "Đợt đang tuyển",
            value: count(jobs?.length),
            to: "/recruitment",
            note: "Đang hoạt động",
          },
        ]
      : profile.professional
        ? [
            {
              label: profile.supervisor
                ? "Nhân sự phụ trách"
                : "Công việc đang mở",
              value: profile.supervisor
                ? d.employeeCount
                : count(work?.filter(isOpenWork).length),
              to: profile.supervisor ? "/employees" : "/professional",
              note: profile.supervisor
                ? "Trong phạm vi của bạn"
                : "Tiến độ hiện tại",
            },
            {
              label: "Quá hạn",
              value: count(work?.filter((w) => isOverdueWork(w, day)).length),
              to: "/professional",
              note: "Công việc chưa hoàn tất",
            },
            {
              label: profile.supervisor ? "Cần bạn nghiệm thu" : "Chờ rà soát",
              value: count(
                work?.filter((w) =>
                  profile.supervisor
                    ? w.actions.includes("approve")
                    : w.status === "in_review",
                ).length,
              ),
              to: "/professional",
              note: "Tiến độ hiện tại",
            },
            {
              label: "Đã nghiệm thu",
              value: count(work?.filter((w) => w.status === "done").length),
              to: "/professional",
              note: "Tổng công việc hiện có",
            },
          ]
        : [
            {
              label: "Phép còn lại",
              value: balance?.available ?? "—",
              to: "/leave/my",
              note: "Ngày phép năm khả dụng",
            },
            {
              label: "Lịch đã duyệt",
              value: count(
                schedules?.filter((s) => s.status === "approved").length,
              ),
              to: "/work-schedule",
              note: "Trong kỳ thống kê",
            },
            {
              label: "Phiếu chờ duyệt",
              value: count(pendingRequests),
              to: "/requests/my",
              note: "Trong kỳ thống kê",
            },
            {
              label: "Nghỉ phép chờ duyệt",
              value: d.pendingLeaves,
              to: "/leave/my",
              note: "Trong kỳ thống kê",
            },
          ];
  return (
    <div className="dashboard" data-focus={profile.focus}>
      <header className="dashboard-header">
        <div>
          <p className="dashboard-context">
            <span>{t(roleDefinitions[me.actor.role].label)}</span>
            <span aria-hidden="true">/</span>
            {t(d.scope)}
          </p>
          <h1>{t(profile.title)}</h1>
          <p className="dashboard-greeting">
            {me.employee.name}
            <span aria-hidden="true"> · </span>
            {dateText(day)}
          </p>
        </div>
        <Link className="button primary" to={profile.primaryPath}>
          {t(profile.primaryLabel)}
          <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      </header>
      <DashboardRangeFilter range={range} onChange={onRangeChange} />
      <section className="dashboard-stats" aria-label={t("Số liệu tổng quan")}>
        {stats.map((stat) => (
          <Link key={stat.label} className="dashboard-stat" to={stat.to}>
            <span className="dashboard-stat-label">
              {t(stat.label)}
              <ArrowUpRight size={15} aria-hidden="true" />
            </span>
            <strong>{stat.value}</strong>
            <small>{t(stat.note)}</small>
          </Link>
        ))}
      </section>
      <section
        className="dashboard-inbox"
        aria-label={t(
          profile.supervisor ? "Cần bạn xử lý" : "Yêu cầu đang chờ",
        )}
      >
        <div className="dashboard-inbox-label">
          <Inbox size={18} aria-hidden="true" />
          <strong>
            {t(profile.supervisor ? "Cần bạn xử lý" : "Yêu cầu đang chờ")}
          </strong>
        </div>
        <div className="dashboard-queue-list">
          {queues.map(({ title, count: value, to, icon: Icon }) => (
            <Link key={to} to={to}>
              <Icon size={18} aria-hidden="true" />
              <span>{t(title)}</span>
              <strong data-pending={!!value}>{count(value)}</strong>
              <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>
      <div className="dashboard-workspace">
        <div className="dashboard-primary">
          {profile.focus === "organization" && <DashboardTeam data={d} />}
          {profile.focus === "recruitment" ? (
            <DashboardRecruitment resource={r.recruitment} />
          ) : (
            profile.professional && (
              <DashboardWork resource={r.work} team={profile.supervisor} />
            )
          )}
          <DashboardActivity
            resources={r}
            data={d}
            supervisor={profile.supervisor}
          />
          {profile.focus === "team" && <DashboardTeam data={d} />}
          {profile.supervisor && profile.focus !== "recruitment" && (
            <DashboardRecruitment resource={r.recruitment} />
          )}
        </div>
        <div className="dashboard-aside">
          <DashboardPersonal attendance={attendance} balance={balance} />
          <div className="dashboard-aside-link">
            <span>{t("Kết nối đội ngũ")}</span>
            <Link to="/chat">
              {t("Nhắn tin cho đồng nghiệp")}
              <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
      <DashboardShortcuts key={me.actor.role} role={me.actor.role} />
      <p className="dashboard-updated" role="status">
        {refreshing
          ? t("Đang cập nhật…")
          : t("Cập nhật lúc {0}", [
              new Date(d.asOf).toLocaleTimeString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Ho_Chi_Minh",
              }),
            ])}
      </p>
    </div>
  );
}
