import {
  querySchema,
  type Query,
  type State,
  type Table,
  type Actor,
} from "@hoosoo/shared";
import {
  readState,
  mergeState,
  type ReadPlan,
  type ReadSelection,
} from "../database/store";
import {
  actorFor,
  requireRole,
  inScope,
  scopedEmployee,
} from "../common/authorization";
import { businessDate } from "../utils/time";
import { matchEmployee } from "../common/query";
import { leaveList } from "../modules/leave/leave.queries";
import { readRecentLeaves } from "../database/ordered-reads";

export type RequestScope = {
  path: string;
  query: Query;
  params: Record<string, string | string[]>;
};
const groups = <T>(items: T[], size = 30) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size),
  );
const byEmployees = (ids: string[]): ReadSelection =>
  ids.length
    ? {
        any: groups(ids).map((value) => ({
          field: "employeeId",
          op: "in",
          value,
        })),
      }
    : { ids: [] };

async function load(s: State, plan: ReadPlan, fresh = false) {
  if (!Object.keys(plan).length) return;
  mergeState(s, await readState([], plan, { fresh }));
}

// Authorization never depends on a retained cache entry, even when no stream is
// connected or someone revokes access directly in the Firebase console.
export async function requestState(
  uid: string,
  selected: readonly Table[],
  selfOnly: boolean,
  scope?: RequestScope,
) {
  const s = await readState(
    ["memberships"],
    { memberships: { ids: [uid] } },
    { fresh: true },
  );
  const employeeId = s.memberships[uid]?.employeeId;
  await load(s, { employees: { ids: employeeId ? [employeeId] : [] } }, true);
  const a = actorFor(s, uid);
  const q = scope?.query ?? querySchema.parse({});
  const path = scope?.path ?? "";
  if (path === "/users" || path === "/audit-logs") requireRole(a, ["Admin"]);
  if (path === "/employees" || path.startsWith("/reports/"))
    requireRole(a, ["Admin", "HR", "Manager"]);
  if (selfOnly) {
    await load(s, Object.fromEntries(selected.map((table) => [table, true])));
    return { s, a };
  }

  const publicDirectory = [
    "/departments",
    "/positions",
    "/organization/tree",
    "/users",
  ].includes(path);
  const target = scope?.params.employeeId
    ? String(scope.params.employeeId)
    : undefined;
  const needsDirectory =
    publicDirectory ||
    !path ||
    path === "/employees" ||
    path === "/dashboard" ||
    path.startsWith("/reports/") ||
    ["/attendance", "/leave-requests", "/leave-balances"].includes(path);
  if (target) {
    if (target !== a.employeeId)
      await load(s, { employees: { ids: [target] } }, true);
    scopedEmployee(s, a, target);
  } else if (needsDirectory) {
    const self = s.employees[a.employeeId];
    // `mine` narrows attendance/leave, but the existing employee-directory and
    // dashboard headcount semantics intentionally do not apply that flag.
    const directoryMetrics = [
      "/employees",
      "/reports/employees",
      "/dashboard",
    ].includes(path);
    if (
      publicDirectory ||
      (a.role !== "Employee" && (q.mine !== "true" || directoryMetrics))
    ) {
      if (!publicDirectory && q.employeeId)
        await load(s, { employees: { ids: [q.employeeId] } }, true);
      else if (!publicDirectory && a.role === "Manager")
        await load(
          s,
          { employees: { field: "managerId", value: a.employeeId } },
          true,
        );
      else await load(s, { employees: true });
    }
    // A cached directory must never overwrite the freshly checked actor.
    s.employees[a.employeeId] = self;
  }

  const visibleIds = Object.values(s.employees)
    .filter(
      (e) =>
        inScope(s, a, e) &&
        matchEmployee(e, q) &&
        (q.mine !== "true" || e.id === a.employeeId),
    )
    .map((e) => e.id)
    // Actor-first state insertion order differs across roles. Use the same
    // employee-ID chunks/cache keys for identical scopes (for example Admin/HR).
    .sort();
  const plan: ReadPlan = Object.fromEntries(
    selected
      .filter((table) => table !== "employees")
      .map((table) => [table, true]),
  );

  if (path === "/leave-requests/:requestId") {
    await load(s, {
      leaveRequests: { ids: [String(scope!.params.requestId)] },
    });
    const record = s.leaveRequests[String(scope!.params.requestId)];
    if (record && record.employeeId !== a.employeeId)
      await load(s, { employees: { ids: [record.employeeId] } }, true);
    delete plan.leaveRequests;
  } else if (plan.leaveRequests) plan.leaveRequests = byEmployees(visibleIds);
  if (plan.auditLogs && target)
    plan.auditLogs = { field: "targetId", value: target };
  const year = q.year ?? Number(businessDate().slice(0, 4));
  const balanceIds =
    path === "/dashboard"
      ? visibleIds.filter((id) => id === a.employeeId)
      : visibleIds;
  if (plan.leaveBalances)
    plan.leaveBalances = { ids: balanceIds.map((id) => `${id}_${year}`) };
  if (plan.leaveBalanceTransactions)
    plan.leaveBalanceTransactions =
      balanceIds.length > 2
        ? { field: "year", value: year }
        : byEmployees(balanceIds);
  if (path === "/leave-balances" || path === "/reports/balances")
    plan.leaveRequests = { field: "status", value: "pending" };

  if (plan.attendanceRecords)
    plan.attendanceRecords = attendancePlan(path, q, a, visibleIds);
  if (path === "/dashboard")
    plan.leaveRequests = { field: "status", value: "pending" };
  // Attendance conflict checks need only leave requests touching returned dates.
  const attendanceOnly =
    path === "/attendance" ||
    path === "/attendance/today" ||
    path === "/reports/attendance";
  if (attendanceOnly) delete plan.leaveRequests;
  await load(s, plan);
  if (attendanceOnly || path === "/dashboard") {
    const dates = [
      ...new Set(Object.values(s.attendanceRecords).map((row) => row.date)),
    ];
    await load(s, {
      leaveRequests: {
        any: groups(dates).map((value) => ({
          field: "workDates",
          op: "array-contains-any",
          value,
        })),
      },
    });
  }
  if (path === "/dashboard") {
    const recent = await readRecentLeaves(
      (row) =>
        leaveList({ ...s, leaveRequests: { [row.id]: row } }, a, q).length > 0,
    );
    for (const row of recent) s.leaveRequests[row.id] = row;
  }
  return { s, a };
}

function attendancePlan(
  path: string,
  q: Query,
  a: Actor,
  ids: string[],
): ReadSelection {
  const today = businessDate();
  if (path === "/attendance/today")
    return { ids: [`${a.employeeId}_${today}`] };
  const from = path === "/dashboard" ? today : q.startDate;
  const to = path === "/dashboard" ? today : q.endDate;
  if (!ids.length) return { ids: [] };
  if (
    (a.role === "Admin" || a.role === "HR") &&
    !q.employeeId &&
    q.mine !== "true"
  ) {
    if (from || to)
      return {
        filters: [
          ...(from ? [{ field: "date", op: ">=" as const, value: from }] : []),
          ...(to ? [{ field: "date", op: "<=" as const, value: to }] : []),
        ],
      };
    return byEmployees(ids);
  }
  // Attendance IDs are employeeId_YYYY-MM-DD. Single-field document-ID ranges
  // enforce both employee and dates without a new composite index or offsets.
  return {
    any: ids.map((id) => ({
      filters: [
        { field: "__name__", op: ">=", value: `${id}_${from ?? "0000-00-00"}` },
        { field: "__name__", op: "<=", value: `${id}_${to ?? "9999-12-31"}` },
      ],
    })),
  };
}
