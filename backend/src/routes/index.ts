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

export const api = Router();
api.use(eventsRoutes);
api.use(accountsRoutes);
api.use(dashboardRoutes);
api.use(employeesRoutes);
api.use(organizationRoutes);
api.use(attendanceRoutes);
api.use(leaveRoutes);
api.use(settingsRoutes);
api.use(reportsRoutes);

api.use(workflowsRoutes);
api.use(recruitmentRoutes);

api.use(professionalRoutes);
