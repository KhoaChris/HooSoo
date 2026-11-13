import {
  isSupervisorRole,
  professionalRoles,
  type Role,
  type WorkItemView,
} from "@hoosoo/shared";
import { navigation } from "../../layouts/navigation";
import type { DashboardRange } from "./dashboard-data";

const titles: Record<Role, string> = {
  Admin: "Toàn cảnh doanh nghiệp",
  HR: "Điều hành nhân sự",
  Director: "Toàn cảnh phòng ban",
  Manager: "Điều hành phòng ban",
  DeputyManager: "Đội ngũ phụ trách",
  ProjectManager: "Tiến độ & bàn giao",
  TeamLead: "Công việc của đội ngũ",
  Developer: "Không gian phát triển",
  QA: "Kế hoạch chất lượng",
  QC: "Kiểm thử & báo lỗi",
  BA: "Yêu cầu & phân tích",
  Designer: "Thiết kế & bàn giao",
  DevOps: "Triển khai & vận hành",
  Employee: "Ngày làm việc của bạn",
};
export function dashboardRole(role: Role) {
  const supervisor = isSupervisorRole(role);
  return {
    title: titles[role],
    supervisor,
    professional: professionalRoles.includes(role),
    focus:
      role === "Admin"
        ? "organization"
        : role === "HR"
          ? "recruitment"
          : supervisor
            ? "team"
            : role === "Employee"
              ? "personal"
              : "work",
    primaryPath:
      role === "Admin"
        ? "/reports"
        : role === "HR"
          ? "/recruitment"
          : role === "Employee"
            ? "/work-schedule"
            : "/professional",
    primaryLabel:
      role === "Admin"
        ? "Xem báo cáo"
        : role === "HR"
          ? "Theo dõi tuyển dụng"
          : role === "Employee"
            ? "Đăng ký lịch làm việc"
            : "Mở không gian công việc",
  } as const;
}

/** Reuse existing scoped endpoints and the shared canonical query cache. */
export function dashboardPaths(role: Role, range: DashboardRange) {
  const profile = dashboardRole(role);
  const dates = new URLSearchParams({
    startDate: range.start,
    endDate: range.end,
  });
  const approvals = profile.supervisor ? "&approvals=true" : "";
  return {
    base: `/dashboard?${dates}`,
    schedules: `/work-registrations?${dates}${approvals}`,
    requests: `/internal-requests?${dates}${approvals}`,
    leaves: profile.supervisor
      ? `/leave-requests?${dates}&approvals=true&status=pending&page=1&pageSize=5`
      : null,
    work: profile.professional ? "/professional/workspace" : null,
    recruitment: profile.supervisor ? "/recruitment/jobs" : null,
  };
}
export function dashboardLinks(role: Role) {
  return navigation
    .filter((item) => item.path !== "/dashboard" && item.roles.includes(role))
    .map((item) => ({
      ...item,
      section: [
        "/settings",
        "/settings/users",
        "/settings/system",
        "/audit-logs",
      ].includes(item.path)
        ? "admin"
        : [
              "/profile",
              "/attendance/my",
              "/leave/my",
              "/work-schedule",
              "/requests/my",
              "/access",
            ].includes(item.path)
          ? "personal"
          : "workspace",
    }));
}
export const isPendingApproval = (status: string) =>
  status === "pending_manager" || status === "pending_hr";
export function pendingWorkflowCount(
  items: { status: string; canReview: boolean }[],
  supervisor: boolean,
) {
  return items.filter(
    (item) => isPendingApproval(item.status) && (!supervisor || item.canReview),
  ).length;
}
export const isOpenWork = (item: WorkItemView) =>
  item.status !== "done" && item.status !== "cancelled";
export const isOverdueWork = (item: WorkItemView, day: string) =>
  isOpenWork(item) && !!item.dueDate && item.dueDate < day;
export function priorityWork(items: WorkItemView[], day: string) {
  const rank = (item: WorkItemView) =>
    item.actions.includes("approve")
      ? 0
      : isOverdueWork(item, day)
        ? 1
        : item.status === "returned"
          ? 2
          : item.priority === "high"
            ? 3
            : 4;
  return items
    .filter(isOpenWork)
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        (a.dueDate || "9999").localeCompare(b.dueDate || "9999") ||
        (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
    );
}
