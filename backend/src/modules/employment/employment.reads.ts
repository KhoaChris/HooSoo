import {
  employmentTables,
  isSupervisorRole,
  type Actor,
  type State,
  type EmploymentSection,
} from "@hoosoo/shared";
import {
  readState,
  mergeState,
  type StateReader,
  type ReadSelection,
} from "../../database/store";
import { loadEmployeeAccess } from "../../common/access-state";
import { isHR, inScope, canManageEmployee } from "../../common/authorization";
import { assert } from "../../utils/errors";
export async function employmentRead(
  s: State,
  a: Actor,
  section: EmploymentSection,
  team: boolean,
) {
  assert(
    !team || (section === "contracts" ? isHR(a) : isSupervisorRole(a.role)),
    403,
    "FORBIDDEN",
    "Bạn không có quyền xem danh sách này.",
  );
  if (team) {
    const self = s.employees[a.employeeId];
    mergeState(
      s,
      await readState(
        [],
        {
          employees: isHR(a)
            ? true
            : { field: "departmentId", value: self.departmentId },
        },
        { fresh: true },
      ),
    );
    await loadEmployeeAccess(
      (plan) => readState([], plan, { fresh: true }),
      s,
      Object.keys(s.employees),
    );
  }
  const ids = Object.values(s.employees)
    .filter((e) =>
      team
        ? inScope(s, a, e) && canManageEmployee(s, a, e.id)
        : e.id === a.employeeId,
    )
    .map((e) => e.id)
    .sort();
  const selections: ReadSelection[] = [];
  for (let i = 0; i < ids.length; i += 30)
    selections.push({
      field: "employeeId",
      op: "in",
      value: ids.slice(i, i + 30),
    });
  if (selections.length)
    mergeState(
      s,
      await readState([], { [employmentTables[section]]: { any: selections } }),
    );
  const managers = [
    ...new Set(
      Object.values(s.employees)
        .map((e) => e.managerId)
        .filter((id) => !!id && !s.employees[id]),
    ),
  ].sort();
  if (managers.length) {
    mergeState(
      s,
      await readState([], { employees: { ids: managers } }, { fresh: true }),
    );
    await loadEmployeeAccess(
      (plan) => readState([], plan, { fresh: true }),
      s,
      managers,
    );
  }
}
export async function employmentCommand(
  read: StateReader,
  s: State,
  a: Actor,
  route: string,
  body: unknown,
  replay?: { id?: string },
) {
  if (!route.startsWith("/employment/")) return false;
  const [, , section, id] = route.split("/") as [
    string,
    string,
    EmploymentSection,
    string?,
  ];
  const table = employmentTables[section];
  assert(table, 404, "NOT_FOUND", "Không tìm thấy hồ sơ.");
  const recordId = id || replay?.id;
  if (recordId) mergeState(s, await read({ [table]: { ids: [recordId] } }));
  const input = body as { employeeId?: string },
    old = recordId ? s[table][recordId] : undefined;
  const employeeId = old?.employeeId || input.employeeId;
  if (employeeId) {
    mergeState(s, await read({ employees: { ids: [employeeId] } }));
    const managerId = s.employees[employeeId]?.managerId;
    if (managerId && !s.employees[managerId])
      mergeState(s, await read({ employees: { ids: [managerId] } }));
    await loadEmployeeAccess(read, s, [
      employeeId,
      ...(managerId ? [managerId] : []),
    ]);
    if (!id || route.endsWith("/activate"))
      mergeState(
        s,
        await read({ [table]: { field: "employeeId", value: employeeId } }),
      );
  }
  return true;
}
