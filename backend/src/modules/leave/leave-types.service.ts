import { randomUUID } from "node:crypto";
import type { State, Actor, LeaveType } from "@hoosoo/shared";
import { notFound } from "../../utils/errors";
import { audit } from "../../common/audit";
import { requireRole } from "../../common/authorization";

export function saveLeaveType(
  s: State,
  a: Actor,
  input: Omit<LeaveType, "id">,
  id?: string,
) {
  requireRole(a, ["Admin", "HR"]);
  if (id && !s.leaveTypes[id]) notFound();
  const result = { ...input, id: id || randomUUID() };
  s.leaveTypes[result.id] = result;
  audit(s, a, "leave_type.updated", result.id, {
    name: result.name,
    active: result.active,
    deductsBalance: result.deductsBalance,
  });
  return result;
}
