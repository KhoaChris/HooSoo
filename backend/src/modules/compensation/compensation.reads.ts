import {
  compensationReaders,
  compensationWriters,
  type State,
  type Actor,
} from "@hoosoo/shared";
import {
  readState,
  mergeState,
  type StateReader,
  type ReadSelection,
} from "../../database/store";
import { loadEmployeeAccess } from "../../common/access-state";
import { requireRole, isHR } from "../../common/authorization";
import { notFound } from "../../utils/errors";
import {
  canReadCompensation,
  assertManageCompensation,
} from "./compensation.service";
export async function compensationRead(
  s: State,
  a: Actor,
  team: boolean,
  employeeId?: string,
) {
  if (team) requireRole(a, compensationReaders);
  if (!team && a.role === "Admin")
    mergeState(
      s,
      await readState([], { compensationBands: { ids: ["Admin"] } }),
    );
  const self = s.employees[a.employeeId];
  if (!team && employeeId && employeeId !== a.employeeId) notFound();
  if (team) {
    mergeState(
      s,
      await readState(
        [],
        {
          employees: employeeId
            ? { ids: [employeeId] }
            : isHR(a)
              ? true
              : { field: "departmentId", value: self.departmentId },
        },
        { fresh: true },
      ),
    );
    s.employees[a.employeeId] = self;
    await loadEmployeeAccess(
      (plan) => readState([], plan, { fresh: true }),
      s,
      Object.keys(s.employees),
    );
  }
  if (employeeId && !canReadCompensation(s, a, employeeId)) notFound();
  const ids = Object.values(s.employees)
    .filter(
      (e) =>
        (team ? e.id !== a.employeeId : e.id === a.employeeId) &&
        (!employeeId || e.id === employeeId) &&
        canReadCompensation(s, a, e.id),
    )
    .map((e) => e.id)
    .sort();
  const any: ReadSelection[] = [];
  for (let i = 0; i < ids.length; i += 30)
    any.push({ field: "employeeId", op: "in", value: ids.slice(i, i + 30) });
  if (any.length)
    mergeState(s, await readState([], { compensationRecords: { any } }));
  return ids;
}
export async function compensationCommand(
  read: StateReader,
  s: State,
  a: Actor,
  route: string,
  body: unknown,
  replay?: { id?: string },
) {
  if (!route.startsWith("/compensation/")) return false;
  if (route === "/compensation/admin-band") {
    requireRole(a, ["Admin"]);
    mergeState(s, await read({ compensationBands: { ids: ["Admin"] } }));
    return true;
  }
  requireRole(a, compensationWriters);
  const recordId = route.split("/")[3] || replay?.id;
  if (recordId)
    mergeState(s, await read({ compensationRecords: { ids: [recordId] } }));
  const employeeId =
    (recordId ? s.compensationRecords[recordId]?.employeeId : undefined) ||
    (body as { employeeId?: string }).employeeId;
  if (employeeId) {
    mergeState(s, await read({ employees: { ids: [employeeId] } }));
    await loadEmployeeAccess(read, s, [employeeId]);
    assertManageCompensation(s, a, employeeId);
    mergeState(
      s,
      await read({
        compensationRecords: { field: "employeeId", value: employeeId },
      }),
    );
  }
  return true;
}
