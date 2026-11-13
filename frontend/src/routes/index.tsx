import { t, useLocale } from "../i18n";
import { professionalRoles } from "@hoosoo/shared";
import { supervisorRoles } from "@hoosoo/shared";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { lazy, Suspense } from "react";
import type { Role } from "@hoosoo/shared";
import { useAuth } from "../app/auth";
import { AppLayout } from "../layouts/app-layout";
import { Loading, ErrorBox, Button } from "../components/ui";
import { ErrorPage } from "../pages/errors/error-page";
import { Login } from "../pages/auth/login-page";
import { ApiError } from "../services/api-client";
import { RecordDialog } from "./record-dialog";
import { recordDialogBackground } from "./record-dialog-routes";
const Chat = lazy(() =>
  import("../pages/chat/chat-page").then((m) => ({ default: m.ChatPage })),
);
const Dashboard = lazy(() =>
  import("../pages/dashboard/dashboard-page").then((m) => ({
    default: m.DashboardPage,
  })),
);
const EmployeeList = lazy(() =>
  import("../pages/employees/employee-list-page").then((m) => ({
    default: m.EmployeeList,
  })),
);
const EmployeeEditor = lazy(() =>
  import("../pages/employees/employee-editor-page").then((m) => ({
    default: m.EmployeeEditor,
  })),
);
const EmployeeDetail = lazy(() =>
  import("../pages/employees/employee-detail-page").then((m) => ({
    default: m.EmployeeDetail,
  })),
);
const Organization = lazy(() =>
  import("../pages/organization/organization-page").then((m) => ({
    default: m.OrganizationPage,
  })),
);
const Catalog = lazy(() =>
  import("../pages/organization/catalog-page").then((m) => ({
    default: m.CatalogPage,
  })),
);
const Attendance = lazy(() =>
  import("../pages/attendance/attendance-page").then((m) => ({
    default: m.AttendancePage,
  })),
);
const LeaveList = lazy(() =>
  import("../pages/leave/leave-list-page").then((m) => ({
    default: m.LeaveListPage,
  })),
);
const LeaveCreate = lazy(() =>
  import("../pages/leave/leave-create-page").then((m) => ({
    default: m.LeaveCreate,
  })),
);
const LeaveDetail = lazy(() =>
  import("../pages/leave/leave-detail-page").then((m) => ({
    default: m.LeaveDetail,
  })),
);
const Settings = lazy(() =>
  import("../pages/settings/settings-page").then((m) => ({
    default: m.SettingsPage,
  })),
);
const Users = lazy(() =>
  import("../pages/settings/users-page").then((m) => ({
    default: m.UsersPage,
  })),
);
const System = lazy(() =>
  import("../pages/settings/system-page").then((m) => ({
    default: m.SystemPage,
  })),
);
const Audit = lazy(() =>
  import("../pages/settings/audit-page").then((m) => ({
    default: m.AuditPage,
  })),
);
const Reports = lazy(() =>
  import("../pages/reports/reports-page").then((m) => ({
    default: m.ReportsPage,
  })),
);
const WorkSchedule = lazy(() =>
  import("../pages/workflows/work-schedule-page").then((m) => ({
    default: m.WorkSchedulePage,
  })),
);
const InternalRequests = lazy(() =>
  import("../pages/workflows/internal-requests-page").then((m) => ({
    default: m.InternalRequestsPage,
  })),
);
const Recruitment = lazy(() =>
  import("../pages/recruitment/recruitment-page").then((m) => ({
    default: m.RecruitmentPage,
  })),
);
const Professional = lazy(() =>
  import("../pages/professional/professional-page").then((m) => ({
    default: m.ProfessionalPage,
  })),
);
const Access = lazy(() =>
  import("../pages/professional/access-page").then((m) => ({
    default: m.AccessPage,
  })),
);
function Guard({ roles }: { roles?: Role[] }) {
  useLocale();
  const { loading, user, me, error, logout, retry } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user)
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname + location.search }}
        replace
      />
    );
  // Keep mounted forms and previously loaded data during a dependency outage.
  // Invalid credentials or revoked membership must still block access at once.
  if (error && (!me || !(error instanceof ApiError) || error.status < 500))
    return (
      <main className="access-error">
        <ErrorBox error={error} retry={retry} />
        <Button variant="secondary" onClick={() => void logout()}>
          {t("Đăng xuất")}
        </Button>
      </main>
    );
  if (!me) return <Loading />;
  if (roles && !roles.includes(me.actor.role))
    return <Navigate to="/403" replace />;
  return <Outlet />;
}
export function AppRoutes() {
  useLocale();
  const location = useLocation();
  const background = recordDialogBackground(location);
  return (
    <>
      <Suspense fallback={<Loading />}>
        <Routes location={background ?? location}>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<Login forgot />} />
          <Route element={<Guard />}>
            <Route element={<AppLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="chat" element={<Chat />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="access" element={<Access />} />
              <Route element={<Guard roles={professionalRoles} />}>
                <Route path="professional" element={<Professional />} />
              </Route>
              <Route path="profile" element={<EmployeeDetail personal />} />
              <Route path="organization" element={<Organization />} />
              <Route path="attendance/my" element={<Attendance personal />} />
              <Route path="work-schedule" element={<WorkSchedule />} />
              <Route path="requests/my" element={<InternalRequests />} />
              <Route path="leave/my" element={<LeaveList personal />} />
              <Route path="leave/new" element={<LeaveCreate />} />
              <Route path="leave/:requestId" element={<LeaveDetail />} />
              <Route element={<Guard roles={supervisorRoles} />}>
                <Route
                  path="work-schedule/approvals"
                  element={<WorkSchedule approvals />}
                />
                <Route
                  path="requests/approvals"
                  element={<InternalRequests approvals />}
                />
                <Route path="recruitment" element={<Recruitment />} />
                <Route path="employees" element={<EmployeeList />} />
                <Route
                  path="employees/:employeeId"
                  element={<EmployeeDetail />}
                />
                <Route path="attendance" element={<Attendance />} />
                <Route path="leave/approvals" element={<LeaveList />} />
                <Route path="reports" element={<Reports />} />
              </Route>
              <Route element={<Guard roles={["Admin", "HR"]} />}>
                <Route path="employees/new" element={<EmployeeEditor />} />
                <Route
                  path="employees/:employeeId/edit"
                  element={<EmployeeEditor />}
                />
                <Route
                  path="departments"
                  element={<Catalog kind="departments" />}
                />
                <Route
                  path="positions"
                  element={<Catalog kind="positions" />}
                />
                <Route path="settings/hr" element={<Settings hr />} />
              </Route>
              <Route element={<Guard roles={["Admin"]} />}>
                <Route path="settings" element={<Settings />} />
                <Route path="settings/users" element={<Users />} />
                <Route path="settings/system" element={<System />} />
                <Route path="audit-logs" element={<Audit />} />
              </Route>
              <Route path="403" element={<ErrorPage forbidden />} />
              <Route path="404" element={<ErrorPage />} />
              <Route path="*" element={<ErrorPage />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
      {background && (
        <Routes>
          <Route element={<Guard />}>
            <Route element={<RecordDialog />}>
              <Route path="/leave/new" element={<LeaveCreate />} />
            </Route>
          </Route>
          <Route element={<Guard roles={["Admin", "HR"]} />}>
            <Route element={<RecordDialog />}>
              <Route
                path="/employees/new"
                element={<EmployeeEditor dialog />}
              />
              <Route
                path="/employees/:employeeId/edit"
                element={<EmployeeEditor dialog />}
              />
            </Route>
          </Route>
        </Routes>
      )}
    </>
  );
}
