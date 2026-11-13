import type { AttendanceView, BalanceView, LeaveView } from "@hoosoo/shared";

export interface DashboardData {
  scope: string;
  asOf: string;
  employeeCount: number;
  departmentCount: number;
  todayAttendance: number;
  pendingLeaves: number;
  newHires: number;
  departments: { id: string; name: string; count: number }[];
  recentLeaves: LeaveView[];
  avatars?: Record<string, string | null>;
  today: AttendanceView[];
  balances: BalanceView[];
}
export type DashboardRange = { start: string; end: string };

/** Use the business date, independent of the browser's timezone. */
export function monthRange(date: string, offset = 0): DashboardRange {
  const [year, month] = date.split("-").map(Number);
  return {
    start: new Date(Date.UTC(year, month - 1 + offset, 1))
      .toISOString()
      .slice(0, 10),
    end: new Date(Date.UTC(year, month + offset, 0)).toISOString().slice(0, 10),
  };
}

export interface DashboardResource<T> {
  data?: T;
  isPending: boolean;
  error: Error | null;
  refetch: () => unknown;
}
export interface DashboardResources {
  schedules: DashboardResource<{
    items: import("@hoosoo/shared").WorkRegistrationView[];
  }>;
  requests: DashboardResource<{
    items: import("@hoosoo/shared").InternalRequestView[];
  }>;
  leaves: DashboardResource<import("@hoosoo/shared").Page<LeaveView>>;
  work: DashboardResource<import("@hoosoo/shared").ProfessionalWorkspace>;
  recruitment: DashboardResource<
    import("../recruitment/job-editor").RecruitmentDirectory
  >;
}
