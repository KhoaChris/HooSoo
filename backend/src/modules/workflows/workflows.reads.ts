import { isDepartmentRole } from "@hoosoo/shared";
import { loadEmployeeAccess } from "../../common/access-state";
import { supervisorRoles } from "@hoosoo/shared";
import type { Actor, State, Query } from "@hoosoo/shared";
import {
  mergeState,
  readState,
  type StateReader,
  type ReadPlan,
} from "../../database/store";
import { requireRole, isHR } from "../../common/authorization";
import { businessDate } from "../../utils/time";
import { jobFor } from "../recruitment/recruitment.service";
export async function workflowRead(
  s: State,
  a: Actor,
  table: "workRegistrations" | "internalRequests",
  q: Query,
) {
  const approvals = q.approvals === "true";
  const self = s.employees[a.employeeId];
  if (approvals) requireRole(a, supervisorRoles);
  if (approvals)
    mergeState(
      s,
      await readState(
        [],
        {
          employees: isHR(a)
            ? true
            : isDepartmentRole(a.role)
              ? { field: "departmentId", value: self.departmentId }
              : { field: "managerId", value: a.employeeId },
        },
        { fresh: !isHR(a) },
      ),
    );
  // Cached directories must not replace the actor checked by requestState.
  s.employees[a.employeeId] = self;
  const ids = approvals
    ? Object.values(s.employees)
        .filter((e) => e.id !== a.employeeId)
        .map((e) => e.id)
    : [a.employeeId];
  const start = q.startDate ?? businessDate().slice(0, 7) + "-01",
    end = q.endDate ?? `${businessDate().slice(0, 4)}-12-31`;
  const selection =
    isHR(a) && approvals
      ? {
          filters: [
            {
              field: table === "workRegistrations" ? "date" : "startDate",
              op: ">=" as const,
              value: start,
            },
            {
              field: table === "workRegistrations" ? "date" : "startDate",
              op: "<=" as const,
              value: end,
            },
          ],
        }
      : table === "workRegistrations"
        ? {
            any: ids.map((id) => ({
              filters: [
                {
                  field: "__name__",
                  op: ">=" as const,
                  value: `${id}_${start}`,
                },
                { field: "__name__", op: "<=" as const, value: `${id}_${end}` },
              ],
            })),
          }
        : { any: ids.map((id) => ({ field: "employeeId", value: id })) };
  mergeState(
    s,
    await readState([], { [table]: selection, settings: { ids: ["main"] } }),
  );
  const managerIds = [
    ...new Set(
      Object.values(s.employees)
        .map((e) => e.managerId)
        .filter(Boolean),
    ),
  ];
  if (managerIds.length)
    mergeState(
      s,
      await readState([], {
        employees: { ids: managerIds },
        memberships: {
          any: managerIds.map((value) => ({ field: "employeeId", value })),
        },
      }),
    );
  await loadEmployeeAccess(
    (plan) => readState([], plan),
    s,
    Object.keys(s.employees),
  );
  return s;
}
export async function featureCommandState(
  read: StateReader,
  s: State,
  a: Actor,
  route: string,
  body: unknown,
) {
  const parts = route.split("/").filter(Boolean),
    input = body as Record<string, unknown>;
  const load = async (plan: ReadPlan) => mergeState(s, await read(plan));
  if (parts[0] === "work-registrations" || parts[0] === "internal-requests") {
    const table =
      parts[0] === "work-registrations"
        ? "workRegistrations"
        : "internalRequests";
    if (parts[1]) await load({ [table]: { ids: [parts[1]] } });
    const r = parts[1] ? s[table][parts[1]] : undefined;
    const employeeId = r?.employeeId ?? a.employeeId;
    await load({
      employees: { ids: [employeeId] },
      settings: { ids: ["main"] },
    });
    await loadEmployeeAccess(read, s, [employeeId]);
    if (!parts[1]) {
      await load({
        memberships: { field: "role", op: "in", value: ["Admin", "HR"] },
      });
      const finalIds = Object.values(s.memberships)
        .filter((m) => m.active && ["Admin", "HR"].includes(m.role))
        .map((m) => m.employeeId);
      if (finalIds.length) await load({ employees: { ids: finalIds } });
    }
    const managerId = s.employees[employeeId]?.managerId;
    if (managerId)
      await load({
        employees: { ids: [managerId] },
        memberships: { field: "employeeId", value: managerId },
      });
    await load({ leaveRequests: { field: "employeeId", value: employeeId } });
    if (table === "workRegistrations" && !parts[1])
      await load({
        workRegistrations: { ids: [`${employeeId}_${input.date}`] },
      });
    if (table === "internalRequests") {
      if (!parts[1])
        await load({
          internalRequests: { field: "employeeId", value: employeeId },
        });
      const date =
        r && "startDate" in r ? r.startDate : String(input.startDate ?? "");
      if (date)
        await load({ attendanceRecords: { ids: [`${employeeId}_${date}`] } });
    }
    return true;
  }
  if (parts[0] !== "recruitment") return false;
  requireRole(a, supervisorRoles);
  if (parts[1] === "jobs") {
    requireRole(a, ["Admin", "HR"]);
    await load({
      recruitmentJobs: { ids: parts[2] ? [parts[2]] : [] },
      departments: { ids: [String(input.departmentId)] },
      employees: { ids: [String(input.hiringManagerId)] },
      memberships: {
        field: "employeeId",
        value: String(input.hiringManagerId),
      },
      candidates: parts[2] ? { field: "jobId", value: parts[2] } : { ids: [] },
    });
  } else {
    if (parts[2]) await load({ candidates: { ids: [parts[2]] } });
    const c = s.candidates[parts[2]],
      jobId = c?.jobId ?? String(input.jobId ?? "");
    if (jobId) await load({ recruitmentJobs: { ids: [jobId] } });
    if (
      jobId &&
      (!parts[2] || !parts[3] || ["hire", "direct-hire"].includes(parts[3]))
    )
      await load({ candidates: { field: "jobId", value: jobId } });
    if (jobId) jobFor(s, a, jobId);
    if (["hire", "direct-hire", "employee"].includes(parts[3])) {
      requireRole(a, ["Admin", "HR"]);
      const job = s.recruitmentJobs[jobId];
      // One bounded directory read only when hiring, for code/email uniqueness
      // and the existing employee-creation manager/cycle validation.
      await load({
        employees: true,
        employeeSequences: { ids: ["main"] },
        departments: { ids: job ? [job.departmentId] : [] },
        positions: { ids: [String(input.positionId)] },
        memberships: { field: "employeeId", value: job?.hiringManagerId ?? "" },
      });
    }
    if (parts[3] === "interview" || parts[3] === "confirm-interview") {
      const interview = c?.rounds.find(
        (r) => r.stageId === c.stageId,
      )?.interview;
      const date = String(input.date ?? interview?.date ?? ""),
        interviewerId = String(
          input.interviewerId ?? interview?.interviewerId ?? "",
        );
      await load({
        candidates: {
          field: "interviewDates",
          op: "array-contains-any",
          value: [date],
        },
        employees: { ids: interviewerId ? [interviewerId] : [] },
        memberships: { field: "employeeId", value: interviewerId },
      });
    }
    if (parts[3] === "cv")
      await load({
        candidateFiles: {
          ids: Array.from({ length: 8 }, (_, i) => `${parts[2]}_${i}`),
        },
      });
  }
  return true;
}
