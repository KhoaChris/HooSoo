import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  CheckCheck,
  BriefcaseBusiness,
  CalendarDays,
  Clock3,
  FileText,
  Users,
  AlertCircle,
} from "lucide-react";
import { workKindLabels, workStatusLabels, type Role } from "@hoosoo/shared";
import { t } from "../../i18n";
import { Badge } from "../../components/ui";
import { statusTone } from "../../components/ui/status-tone";
import { dateText, today } from "../../utils/date-time";
import {
  dashboardLinks,
  isOverdueWork,
  isPendingApproval,
  priorityWork,
} from "./dashboard-model";
import type {
  DashboardData,
  DashboardResource,
  DashboardResources,
} from "./dashboard-data";

export function SectionHeading({
  title,
  to,
  trailing,
}: {
  title: string;
  to?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="dashboard-section-heading">
      <h2>{t(title)}</h2>
      {trailing ??
        (to && (
          <Link className="dashboard-text-link" to={to}>
            {t("Xem tất cả")}
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        ))}
    </div>
  );
}
export function ResourceState({
  resource,
  children,
  empty,
}: {
  resource: DashboardResource<unknown>;
  children: ReactNode;
  empty?: boolean;
}) {
  if (resource.error)
    return (
      <div className="dashboard-resource-state" role="status">
        <AlertCircle size={19} aria-hidden="true" />
        <span>{t("Chưa tải được dữ liệu")}</span>
        <button type="button" onClick={() => void resource.refetch()}>
          {t("Thử lại")}
        </button>
      </div>
    );
  if (resource.isPending)
    return (
      <div
        className="dashboard-skeleton"
        role="status"
        aria-label={t("Đang tải")}
      >
        <i />
        <i />
        <i />
      </div>
    );
  if (empty)
    return (
      <div className="dashboard-empty">
        <CheckCheck size={24} aria-hidden="true" />
        <span>{t("Chưa có mục nào trong danh sách")}</span>
      </div>
    );
  return children;
}

export function DashboardWork({
  resource,
  team,
}: {
  resource: DashboardResources["work"];
  team: boolean;
}) {
  const [filter, setFilter] = useState<"priority" | "review" | "overdue">(
    "priority",
  );
  const day = today();
  const items = priorityWork(resource.data?.items ?? [], day);
  const rows = items.filter(
    (item) =>
      filter === "priority" ||
      (filter === "review"
        ? item.status === "in_review"
        : isOverdueWork(item, day)),
  );
  return (
    <section className="dashboard-section dashboard-work">
      <SectionHeading
        title={team ? "Tiến độ đội ngũ" : "Công việc được giao"}
        to="/professional"
      />
      <div
        className="dashboard-segment"
        role="group"
        aria-label={t("Lọc công việc")}
      >
        {(
          [
            ["priority", "Ưu tiên"],
            ["review", "Chờ rà soát"],
            ["overdue", "Quá hạn"],
          ] as const
        ).map(([key, label]) => (
          <button
            type="button"
            key={key}
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            {t(label)}
          </button>
        ))}
      </div>
      <ResourceState resource={resource} empty={!rows.length}>
        <ul className="dashboard-list">
          {rows.slice(0, 5).map((item) => (
            <li key={item.id}>
              <Link
                className="dashboard-work-row"
                to={`/professional?item=${encodeURIComponent(item.id)}`}
              >
                <span className="dashboard-row-icon">
                  <BriefcaseBusiness size={18} aria-hidden="true" />
                </span>
                <div className="dashboard-row-copy">
                  <strong>{item.title}</strong>
                  <span>
                    {item.project} · {t(workKindLabels[item.kind])}
                  </span>
                  {team && <small>{item.assigneeName}</small>}
                </div>
                <div className="dashboard-row-end">
                  <span
                    className="status-tone dashboard-status"
                    data-tone={statusTone(item.status)}
                  >
                    {t(workStatusLabels[item.status])}
                  </span>
                  <small
                    className={
                      isOverdueWork(item, day) ? "is-overdue" : undefined
                    }
                  >
                    {item.dueDate
                      ? `${isOverdueWork(item, day) ? t("Quá hạn") + " · " : ""}${dateText(item.dueDate)}`
                      : t("Chưa đặt hạn")}
                  </small>
                </div>
                <ArrowUpRight
                  className="dashboard-row-arrow"
                  size={16}
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      </ResourceState>
    </section>
  );
}

export function DashboardRecruitment({
  resource,
}: {
  resource: DashboardResources["recruitment"];
}) {
  const data = resource.data;
  const jobs = (data?.items ?? []).filter((job) => job.active);
  return (
    <section className="dashboard-section">
      <SectionHeading title="Các đợt đang tuyển" to="/recruitment" />
      <ResourceState resource={resource} empty={!jobs.length}>
        <ul className="dashboard-list">
          {jobs.slice(0, 4).map((job) => (
            <li key={job.id}>
              <Link
                className="dashboard-work-row"
                to={`/recruitment?job=${encodeURIComponent(job.id)}`}
              >
                <span className="dashboard-row-icon">
                  <Users size={18} aria-hidden="true" />
                </span>
                <div className="dashboard-row-copy">
                  <strong>{job.title}</strong>
                  <span>
                    {data?.departments.find((d) => d.id === job.departmentId)
                      ?.name || t("Chưa có phòng ban")}
                  </span>
                  <small>
                    {data?.reviewers.find((p) => p.id === job.hiringManagerId)
                      ?.name || t("Chưa phân công")}
                  </small>
                </div>
                <div className="dashboard-row-end">
                  <strong>
                    {job.openings} <small>{t("chỉ tiêu")}</small>
                  </strong>
                  <small>{t("{0} vòng tuyển dụng", [job.stages.length])}</small>
                </div>
                <ArrowUpRight
                  className="dashboard-row-arrow"
                  size={16}
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      </ResourceState>
    </section>
  );
}

export function DashboardTeam({ data }: { data: DashboardData }) {
  const departments = data.departments
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count);
  const total = departments.reduce((n, d) => n + d.count, 0);
  return (
    <section className="dashboard-section dashboard-team">
      <SectionHeading title="Phân bổ đội ngũ" to="/organization" />
      <div className="dashboard-team-layout">
        <div className="dashboard-team-total">
          <strong>{data.employeeCount}</strong>
          <span>{t("nhân viên hiện tại")}</span>
          <Link className="dashboard-text-link" to="/employees">
            {t("Xem nhân viên")}
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
        <div className="dashboard-department-list">
          {departments.length ? (
            departments.slice(0, 5).map((d) => (
              <div key={d.id}>
                <div className="dashboard-department-label">
                  <span>{d.name}</span>
                  <strong>{d.count}</strong>
                </div>
                <div className="dashboard-meter" aria-hidden="true">
                  <span
                    style={{
                      width: `${(d.count / Math.max(total, 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))
          ) : (
            <p className="dashboard-caption">{t("Chưa có dữ liệu đội ngũ")}</p>
          )}
        </div>
      </div>
    </section>
  );
}

export function DashboardActivity({
  resources,
  data,
  supervisor,
}: {
  resources: DashboardResources;
  data: DashboardData;
  supervisor: boolean;
}) {
  const [tab, setTab] = useState<"schedules" | "requests" | "leaves">(
    "schedules",
  );
  const resource =
    tab === "leaves"
      ? supervisor
        ? resources.leaves
        : { data: true, isPending: false, error: null, refetch: () => {} }
      : resources[tab];
  const schedules = [...(resources.schedules.data?.items ?? [])].sort(
    (a, b) =>
      Number(b.canReview) - Number(a.canReview) || a.date.localeCompare(b.date),
  );
  const requests = [...(resources.requests.data?.items ?? [])].sort(
    (a, b) =>
      Number(b.canReview) - Number(a.canReview) ||
      (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
  );
  const leaves = supervisor
    ? (resources.leaves.data?.items ?? [])
    : data.recentLeaves;
  const rows =
    tab === "schedules" ? schedules : tab === "requests" ? requests : leaves;
  const route =
    tab === "schedules"
      ? `/work-schedule${supervisor ? "/approvals" : ""}`
      : tab === "requests"
        ? `/requests/${supervisor ? "approvals" : "my"}`
        : `/leave/${supervisor ? "approvals" : "my"}`;
  return (
    <section className="dashboard-section dashboard-activity">
      <SectionHeading
        title={
          supervisor ? "Lịch & yêu cầu trong kỳ" : "Lịch & yêu cầu của bạn"
        }
        to={route}
      />
      <div
        className="dashboard-segment"
        role="group"
        aria-label={t("Loại yêu cầu")}
      >
        {(
          [
            ["schedules", "Lịch làm việc", CalendarDays],
            ["requests", "Phiếu đề nghị", FileText],
            ["leaves", "Nghỉ phép", Clock3],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
          >
            <Icon size={15} aria-hidden="true" />
            {t(label)}
          </button>
        ))}
      </div>
      <ResourceState resource={resource} empty={!rows.length}>
        <ul className="dashboard-list">
          {(tab === "schedules"
            ? schedules.slice(0, 4).map((r) => ({
                id: r.id,
                title: supervisor ? r.employeeName : dateText(r.date),
                note: `${supervisor ? dateText(r.date) + " · " : ""}${r.start} – ${r.end}`,
                status: r.status,
                to: route,
              }))
            : tab === "requests"
              ? requests.slice(0, 4).map((r) => ({
                  id: r.id,
                  title: r.title,
                  note: supervisor ? r.employeeName : dateText(r.startDate),
                  status: r.status,
                  to: route,
                }))
              : leaves.slice(0, 4).map((r) => ({
                  id: r.id,
                  title: supervisor ? r.employeeName : r.typeName,
                  note: `${dateText(r.startDate)} – ${dateText(r.endDate)}`,
                  status: r.status,
                  to: `/leave/${r.id}`,
                }))
          ).map((r) => (
            <li key={r.id}>
              <Link className="dashboard-activity-row" to={r.to}>
                <span
                  className={`dashboard-activity-dot${isPendingApproval(r.status) || r.status === "pending" ? " is-pending" : ""}`}
                  aria-hidden="true"
                />
                <div className="dashboard-row-copy">
                  <strong>{r.title}</strong>
                  <span>{r.note}</span>
                </div>
                <Badge value={r.status} />
                <ArrowUpRight
                  className="dashboard-row-arrow"
                  size={16}
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      </ResourceState>
    </section>
  );
}

export function DashboardShortcuts({ role }: { role: Role }) {
  const links = dashboardLinks(role);
  const [section, setSection] = useState("workspace");
  return (
    <section className="dashboard-shortcuts">
      <SectionHeading
        title="Không gian của bạn"
        trailing={
          <div
            className="dashboard-segment"
            role="group"
            aria-label={t("Nhóm chức năng")}
          >
            {(
              [
                ["workspace", "Công cụ nghiệp vụ"],
                ["personal", "Cá nhân"],
                ["admin", "Quản trị"],
              ] as const
            )
              .filter(([key]) => links.some((l) => l.section === key))
              .map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  aria-pressed={section === key}
                  onClick={() => setSection(key)}
                >
                  {t(label)}
                </button>
              ))}
          </div>
        }
      />
      <div className="dashboard-shortcut-list">
        {links
          .filter((l) => l.section === section)
          .map(({ path, label, icon: Icon }) => (
            <Link key={path} to={path}>
              <Icon size={19} aria-hidden="true" />
              <span>{t(label)}</span>
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          ))}
      </div>
    </section>
  );
}
