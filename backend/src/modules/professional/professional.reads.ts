import {
  professionalRoles,
  roleDefinitions,
  type State,
  type Actor,
} from "@hoosoo/shared";
import { mergeState, readState, type StateReader } from "../../database/store";
import { requireRole } from "../../common/authorization";
import { loadEmployeeAccess } from "../../common/access-state";
export async function professionalDirectory(
  read: StateReader,
  s: State,
  a: Actor,
) {
  requireRole(a, professionalRoles);
  const self = s.employees[a.employeeId],
    membership = s.memberships[a.uid];
  mergeState(
    s,
    await read({
      employees:
        a.role === "Admin"
          ? true
          : { field: "departmentId", value: self.departmentId },
      departments: true,
    }),
  );
  s.employees[a.employeeId] = self;
  mergeState(s, await read({ memberships: { field: "role", value: "Admin" } }));
  const admins = Object.values(s.memberships)
    .filter((m) => m.role === "Admin" && m.active)
    .map((m) => m.employeeId);
  if (admins.length) mergeState(s, await read({ employees: { ids: admins } }));
  s.employees[a.employeeId] = self;
  s.memberships[a.uid] = membership;
  await loadEmployeeAccess(read, s, Object.keys(s.employees));
}
export async function professionalRead(s: State, a: Actor) {
  await professionalDirectory(
    (plan) =>
      readState([], plan, {
        fresh:
          roleDefinitions[a.role].scope === "department" ||
          roleDefinitions[a.role].scope === "reports",
      }),
    s,
    a,
  );
  const scope = roleDefinitions[a.role].scope;
  mergeState(
    s,
    await readState([], {
      workItems:
        a.role === "Admin"
          ? true
          : scope === "department"
            ? {
                field: "departmentId",
                value: s.employees[a.employeeId].departmentId,
              }
            : {
                any: [
                  { field: "createdBy", value: a.uid },
                  { field: "reviewerId", value: a.employeeId },
                  ...Object.values(s.employees)
                    .filter(
                      (e) =>
                        e.id === a.employeeId ||
                        (scope === "reports" && e.managerId === a.employeeId),
                    )
                    .map((e) => ({ field: "assigneeId", value: e.id })),
                ],
              },
    }),
  );
}
export async function professionalCommand(
  read: StateReader,
  s: State,
  a: Actor,
  route: string,
  body: unknown,
) {
  if (!route.startsWith("/professional/")) return false;
  requireRole(a, professionalRoles);
  const id = route.split("/")[3],
    input = body as Record<string, string>;
  if (id) mergeState(s, await read({ workItems: { ids: [id] } }));
  const old = s.workItems[id],
    ids = [
      input.assigneeId,
      input.reviewerId,
      old?.assigneeId,
      old?.reviewerId,
    ].filter(Boolean);
  if (ids.length) mergeState(s, await read({ employees: { ids } }));
  await loadEmployeeAccess(read, s, ids);
  const departmentId = input.departmentId ?? old?.departmentId;
  if (departmentId)
    mergeState(s, await read({ departments: { ids: [departmentId] } }));
  return true;
}
