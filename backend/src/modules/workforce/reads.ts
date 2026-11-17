import { canAccessJob } from "../recruitment/recruitment.service";
import type { State, Actor } from "@hoosoo/shared";
import { isSupervisorRole } from "@hoosoo/shared";
import {
  readState,
  mergeState,
  type StateReader,
  type ReadSelection,
  type ReadPlan,
} from "../../database/store";
import { loadEmployeeAccess } from "../../common/access-state";
import { isHR, requireRole } from "../../common/authorization";
import { allowed, visible, payRead } from "./core";
export const sections = {
  time: "timeRequests",
  payroll: "payrollStatements",
  changes: "personnelChanges",
  documents: "personnelDocuments",
  announcements: "announcements",
} as const;
export type WorkforceSection = keyof typeof sections;
export const selectedEmployees = (ids: string[]): ReadSelection => ({
  any: Array.from({ length: Math.ceil(ids.length / 30) }, (_, i) => ({
    field: "employeeId",
    op: "in" as const,
    value: ids.slice(i * 30, i * 30 + 30),
  })),
});
const cached: StateReader = (plan) => readState([], plan);
export async function directory(
  read: StateReader,
  s: State,
  a: Actor,
  all = false,
) {
  mergeState(
    s,
    await read({
      employees:
        all || isHR(a)
          ? true
          : {
              field: "departmentId",
              value: s.employees[a.employeeId].departmentId,
            },
    }),
  );
  await loadEmployeeAccess(read, s, Object.keys(s.employees));
}
export async function workforceRead(
  s: State,
  a: Actor,
  section: WorkforceSection | "deadlines",
  team: boolean,
) {
  allowed(!team || isSupervisorRole(a.role));
  if (team)
    await directory((plan) => readState([], plan, { fresh: true }), s, a);
  const ids = Object.keys(s.employees).filter((id) =>
    team
      ? section === "payroll"
        ? payRead(s, a, id)
        : visible(s, a, id)
      : id === a.employeeId,
  );
  const selection = selectedEmployees(ids);
  const plan: ReadPlan = {};
  if (section === "announcements")
    Object.assign(plan, {
      announcements: true,
      announcementReceipts: { field: "employeeId", value: a.employeeId },
      departments: true,
    });
  else if (section === "deadlines")
    for (const table of [
      "employmentContracts",
      "probationReviews",
      "onboardingPlans",
      "employeeServices",
      "personnelChanges",
      "personnelDocuments",
    ] as const)
      plan[table] = selection;
  else {
    plan[sections[section]] = selection;
    if (section === "time")
      Object.assign(plan, {
        leaveTypes: true,
        settings: { ids: ["main"] },
        leaveBalances: selection,
      });
    if (section === "changes")
      Object.assign(plan, { departments: true, positions: true });
  }
  mergeState(s, await cached(plan));
  if (section === "deadlines" && isSupervisorRole(a.role)) {
    mergeState(
      s,
      await cached({
        recruitmentJobs: isHR(a)
          ? true
          : { field: "hiringManagerId", value: a.employeeId },
      }),
    );
    const jobs = Object.values(s.recruitmentJobs)
      .filter((j) => canAccessJob(s, a, j))
      .map((j) => j.id);
    if (jobs.length)
      mergeState(
        s,
        await cached({
          candidates: {
            any: Array.from(
              { length: Math.ceil(jobs.length / 30) },
              (_, i) => ({
                field: "jobId",
                op: "in" as const,
                value: jobs.slice(i * 30, i * 30 + 30),
              }),
            ),
          },
        }),
      );
  }
  return ids;
}
export async function sourceRead(read: StateReader, s: State, id: string) {
  mergeState(
    s,
    await read({
      settings: { ids: ["main"] },
      compensationBands: true,
      ...Object.fromEntries(
        [
          "compensationRecords",
          "attendanceRecords",
          "leaveRequests",
          "timeRequests",
          "employeeServices",
          "probationReviews",
          "payrollStatements",
        ].map((t) => [t, { field: "employeeId", value: id }]),
      ),
    }),
  );
}
export async function workforceCommand(
  read: StateReader,
  s: State,
  a: Actor,
  route: string,
  body: unknown,
  replay?: { id?: string },
) {
  if (!route.startsWith("/workforce/")) return false;
  const [, , section, id, action] = route.split("/"),
    input = body as {
      employeeId?: string;
      date?: string;
      period?: string;
      leaveTypeId?: string;
      version?: number;
    };
  if (section === "imports") {
    requireRole(a, ["Admin", "HR"]);
    await directory(read, s, a, true);
    mergeState(
      s,
      await read({
        departments: true,
        positions: true,
        employeeSequences: { ids: ["main"] },
      }),
    );
    return true;
  }
  const table = sections[section as WorkforceSection];
  allowed(!!table);
  const recordId =
    id ||
    replay?.id ||
    (section === "payroll" && input.employeeId && input.period
      ? input.employeeId + "_" + input.period
      : undefined);
  if (recordId) mergeState(s, await read({ [table]: { ids: [recordId] } }));
  const old = recordId ? s[table][recordId] : undefined;
  const employeeId =
    old && "employeeId" in old
      ? old.employeeId
      : section === "time"
        ? a.employeeId
        : input.employeeId;
  if (employeeId) {
    mergeState(s, await read({ employees: { ids: [employeeId] } }));
    await loadEmployeeAccess(read, s, [employeeId]);
  }
  if (section === "payroll" && employeeId) {
    allowed(payRead(s, a, employeeId));
    await sourceRead(read, s, employeeId);
  }
  if (section === "time" && employeeId) {
    allowed(visible(s, a, employeeId));
    if (!id) await directory(read, s, a, true);
    mergeState(
      s,
      await read({
        settings: { ids: ["main"] },
        leaveTypes: true,
        timeRequests: { field: "employeeId", value: employeeId },
        leaveRequests: { field: "employeeId", value: employeeId },
        payrollStatements: { field: "employeeId", value: employeeId },
        leaveBalances: { field: "employeeId", value: employeeId },
      }),
    );
  }
  if (section === "changes" && employeeId) {
    requireRole(a, ["Admin", "HR"]);
    await directory(read, s, a, true);
    mergeState(
      s,
      await read({
        departments: true,
        positions: true,
        personnelChanges: { field: "employeeId", value: employeeId },
        employmentContracts: { field: "employeeId", value: employeeId },
        compensationRecords: { field: "employeeId", value: employeeId },
      }),
    );
  }
  if (section === "announcements") {
    if (action !== "acknowledge") requireRole(a, ["Admin", "HR"]);
    mergeState(
      s,
      await read({
        departments: true,
        announcementReceipts: { field: "employeeId", value: a.employeeId },
      }),
    );
  }
  return true;
}
