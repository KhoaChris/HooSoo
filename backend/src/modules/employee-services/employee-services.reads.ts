import {
  isSupervisorRole,
  type State,
  type Actor,
  type ServiceSection,
} from "@hoosoo/shared";
import {
  readState,
  mergeState,
  type StateReader,
  type ReadSelection,
} from "../../database/store";
import { loadEmployeeAccess } from "../../common/access-state";
import { isHR } from "../../common/authorization";
import { assert } from "../../utils/errors";
import { serviceManager } from "./employee-services.service";

export async function servicesRead(
  s: State,
  a: Actor,
  section: ServiceSection,
  team: boolean,
) {
  assert(
    !team || isSupervisorRole(a.role),
    403,
    "FORBIDDEN",
    "Bạn không có quyền xem danh sách này.",
  );
  if (team) {
    mergeState(
      s,
      await readState(
        [],
        {
          employees: isHR(a)
            ? true
            : {
                field: "departmentId",
                value: s.employees[a.employeeId].departmentId,
              },
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
  const ids = Object.keys(s.employees)
    .filter((id) => (team ? serviceManager(s, a, id) : id === a.employeeId))
    .sort();
  const parts: ReadSelection[] = [];
  for (let i = 0; i < ids.length; i += 30)
    parts.push({ field: "employeeId", op: "in", value: ids.slice(i, i + 30) });
  if (parts.length)
    mergeState(
      s,
      await readState([], {
        employeeServices: { any: parts },
        ...(team && isHR(a) && section !== "offboarding"
          ? { internalRequests: { any: parts } }
          : {}),
      }),
    );
}
export async function servicesCommand(
  read: StateReader,
  s: State,
  a: Actor,
  route: string,
  body: unknown,
  replay?: { id?: string },
) {
  if (!route.startsWith("/employee-services")) return false;
  const [, , id, action] = route.split("/");
  const input = body as {
    employeeId?: string;
    assetCode?: string;
    sourceRequestId?: string;
  };
  const recordId = id || replay?.id;
  if (recordId)
    mergeState(s, await read({ employeeServices: { ids: [recordId] } }));
  const old = recordId ? s.employeeServices[recordId] : undefined;
  const employeeId = old?.employeeId || input.employeeId;
  if (employeeId) {
    mergeState(
      s,
      await read({
        employees: { ids: [employeeId] },
        employeeServices: { field: "employeeId", value: employeeId },
      }),
    );
    const managerId = s.employees[employeeId]?.managerId;
    if (managerId && !s.employees[managerId])
      mergeState(s, await read({ employees: { ids: [managerId] } }));
    await loadEmployeeAccess(read, s, [
      employeeId,
      ...(managerId ? [managerId] : []),
    ]);
    if (action === "complete") {
      const e = s.employees[employeeId];
      if (e)
        mergeState(
          s,
          await read({
            employees: { field: "managerId", value: employeeId },
            memberships: { field: "employeeId", value: employeeId },
            departments: { ids: [e.departmentId] },
            positions: { ids: [e.positionId] },
            employmentContracts: { field: "employeeId", value: employeeId },
          }),
        );
    }
  }
  if (input.assetCode)
    mergeState(
      s,
      await read({
        employeeServices: { field: "assetCode", value: input.assetCode },
      }),
    );
  const requestId = old?.sourceRequestId || input.sourceRequestId;
  if (requestId)
    mergeState(s, await read({ internalRequests: { ids: [requestId] } }));
  return true;
}
