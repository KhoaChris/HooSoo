import { professionalCommand } from "../modules/professional/professional.reads";
import { loadEmployeeAccess } from "./access-state";
import { supervisorRoles } from "@hoosoo/shared";
import { featureCommandState } from "../modules/workflows/workflows.reads";
import { type StateReader, type ReadPlan, mergeState } from "../database/store";
import { actorFor, requireRole } from "./authorization";
import { businessDate } from "../utils/time";

// Domain functions retain their atomic rules, but only receive the records a
// command actually needs. Audit/ledger appends never scan historical entries.
export async function commandState(
  read: StateReader,
  uid: string,
  route: string,
  body: unknown,
  receiptId: string,
) {
  const s = await read({
    memberships: { ids: [uid] },
    receipts: { ids: [receiptId] },
  });
  const employeeId = s.memberships[uid]?.employeeId;
  mergeState(
    s,
    await read({ employees: { ids: employeeId ? [employeeId] : [] } }),
  );
  const actor = actorFor(s, uid);
  if (await professionalCommand(read, s, actor, route, body)) {
    const replay = s.receipts[receiptId]?.result as { id?: string } | undefined;
    if (replay?.id && !s.workItems[replay.id])
      await professionalCommand(
        read,
        s,
        actor,
        "/professional/work-items/" + replay.id,
        body,
      );
    return s;
  }
  if (await featureCommandState(read, s, actor, route, body)) return s;
  const input = body as {
    leaveTypeId?: string;
    startDate?: string;
    year?: number;
    companyName?: string;
  };
  const parts = route.split("/").filter(Boolean);
  const plan: ReadPlan = {};
  switch (parts[0]) {
    case "me":
      break;
    case "departments":
    case "positions":
      requireRole(actor, ["Admin", "HR"]);
      plan[parts[0]] = true;
      if (parts[1] && parts[1] !== "templates") {
        plan.employees = true;
        plan.memberships = true;
      }
      break;
    case "employees":
      requireRole(actor, ["Admin", "HR"]);
      Object.assign(plan, {
        employees: true,
        memberships: true,
        departments: true,
        positions: true,
      });
      break;
    case "users":
      requireRole(actor, ["Admin"]);
      Object.assign(plan, { employees: true, memberships: true });
      break;
    case "settings":
      requireRole(
        actor,
        input.companyName === undefined ? ["Admin", "HR"] : ["Admin"],
      );
      plan.settings = { ids: ["main"] };
      break;
    case "attendance":
      if (parts[2] === "adjustment") requireRole(actor, ["Admin", "HR"]);
      plan.attendanceRecords = {
        ids: [
          parts[1] === "check-in" || parts[1] === "check-out"
            ? employeeId + "_" + businessDate()
            : parts[1],
        ],
      };
      plan.settings = { ids: ["main"] };
      if (parts[2] === "adjustment") plan.employees = true;
      break;
    case "leave-types":
      requireRole(actor, ["Admin", "HR"]);
      plan.leaveTypes = true;
      break;
    case "leave-balances":
      requireRole(actor, ["Admin", "HR"]);
      plan.employees = true;
      plan.settings = { ids: ["main"] };
      plan.leaveBalances = { ids: [parts[1] + "_" + input.year] };
      break;
    case "leave-requests": {
      if (parts[2] === "approve" || parts[2] === "reject")
        requireRole(actor, supervisorRoles);
      plan.employees = true;
      plan.settings = { ids: ["main"] };
      if (!parts[1]) {
        plan.memberships = true;
        plan.leaveRequests = { field: "employeeId", value: employeeId! };
        plan.leaveTypes = { ids: [input.leaveTypeId!] };
        plan.leaveBalances = {
          ids: [employeeId + "_" + input.startDate!.slice(0, 4)],
        };
      } else {
        mergeState(s, await read({ leaveRequests: { ids: [parts[1]] } }));
        const leave = s.leaveRequests[parts[1]];
        plan.leaveBalances = {
          ids: leave
            ? [leave.employeeId + "_" + leave.startDate.slice(0, 4)]
            : [],
        };
      }
      break;
    }
    default:
      throw new Error("Missing command read plan: " + parts[0]);
  }
  mergeState(s, await read(plan));
  const targetId =
    parts[0] === "attendance"
      ? s.attendanceRecords[parts[1]]?.employeeId
      : parts[0] === "leave-requests"
        ? s.leaveRequests[parts[1]]?.employeeId
        : ["employees", "leave-balances"].includes(parts[0])
          ? parts[1]
          : undefined;
  if (targetId) await loadEmployeeAccess(read, s, [targetId]);
  return s;
}
