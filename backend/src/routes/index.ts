import { compensationRoutes } from "../modules/compensation/compensation.routes";
import { presenceRoutes } from "../modules/presence/presence.routes";
import { performanceRoutes } from "../modules/performance/performance.routes";
import { employmentRoutes } from "../modules/employment/employment.routes";
import { notificationsRoutes } from "../modules/notifications/notifications.routes";
import { professionalRoutes } from "../modules/professional/professional.routes";
import { workflowsRoutes } from "../modules/workflows/workflows.routes";
import { recruitmentRoutes } from "../modules/recruitment/recruitment.routes";
import { Router } from "express";
import { accountsRoutes } from "../modules/accounts/accounts.routes";
import { dashboardRoutes } from "../modules/dashboard/dashboard.routes";
import { employeesRoutes } from "../modules/employees/employees.routes";
import { organizationRoutes } from "../modules/organization/organization.routes";
import { attendanceRoutes } from "../modules/attendance/attendance.routes";
import { leaveRoutes } from "../modules/leave/leave.routes";
import { settingsRoutes } from "../modules/settings/settings.routes";
import { reportsRoutes } from "../modules/reports/reports.routes";
import { eventsRoutes } from "../modules/events/events.routes";

import { avatarRoutes } from "../modules/employees/avatar.routes";

import { chatRoutes } from "../modules/chat/chat.routes";
export const api = Router();
// The explorer reads this same registry; it never invokes route handlers.
export const apiRouteGroups = [
  { id: "compensation", name: "Lương & phúc lợi", router: compensationRoutes },
  { id: "presence", name: "Trạng thái hoạt động", router: presenceRoutes },
  { id: "performance", name: "Đánh giá hiệu suất", router: performanceRoutes },
  {
    id: "employment",
    name: "Hợp đồng, thử việc & tiếp nhận",
    router: employmentRoutes,
  },
  { id: "notifications", name: "Thông báo", router: notificationsRoutes },
  { id: "chat", name: "Tin nhắn", router: chatRoutes },
  { id: "avatars", name: "Ảnh đại diện", router: avatarRoutes },
  { id: "events", name: "Đồng bộ trực tiếp", router: eventsRoutes },
  { id: "accounts", name: "Hồ sơ & tài khoản", router: accountsRoutes },
  { id: "dashboard", name: "Tổng quan", router: dashboardRoutes },
  { id: "employees", name: "Nhân viên", router: employeesRoutes },
  { id: "organization", name: "Cơ cấu tổ chức", router: organizationRoutes },
  { id: "attendance", name: "Chấm công", router: attendanceRoutes },
  { id: "leave", name: "Nghỉ phép", router: leaveRoutes },
  { id: "settings", name: "Thiết lập & quản trị", router: settingsRoutes },
  { id: "reports", name: "Báo cáo", router: reportsRoutes },
  { id: "workflows", name: "Lịch & phiếu đề nghị", router: workflowsRoutes },
  { id: "recruitment", name: "Tuyển dụng", router: recruitmentRoutes },
  {
    id: "professional",
    name: "Công việc chuyên môn",
    router: professionalRoutes,
  },
];
for (const group of apiRouteGroups) api.use(group.router);
