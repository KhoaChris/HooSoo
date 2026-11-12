import { randomUUID } from "node:crypto";
import {
  allowedWorkKinds,
  isSupervisorRole,
  professionalRoles,
  workActions,
  type State,
  type Actor,
  type WorkItem,
  type WorkItemInput,
  type WorkActionInput,
  type WorkAction,
} from "@hoosoo/shared";
import { assert, notFound } from "../../utils/errors";
import {
  requireRole,
  inScope,
  employeeRole,
  canManageEmployee,
} from "../../common/authorization";
import { assertVersion, event } from "../workflows/approval";
import { audit } from "../../common/audit";
export function canSeeWork(s: State, a: Actor, w: WorkItem) {
  if (!professionalRoles.includes(a.role)) return false;
  if (a.role === "Admin") return true;
  if (w.departmentId !== s.employees[a.employeeId]?.departmentId) return false;
  if (!allowedWorkKinds(a.role).includes(w.kind)) return false;
  return (
    w.assigneeId === a.employeeId ||
    w.reviewerId === a.employeeId ||
    w.createdBy === a.uid ||
    (isSupervisorRole(a.role) &&
      !!s.employees[w.assigneeId] &&
      inScope(s, a, s.employees[w.assigneeId]))
  );
}
export function workFor(s: State, a: Actor, id: string) {
  const w = s.workItems[id];
  if (!w || !canSeeWork(s, a, w)) notFound();
  return w;
}
function coordinator(s: State, a: Actor, w: WorkItem) {
  return (
    a.role === "Admin" ||
    (isSupervisorRole(a.role) &&
      a.employeeId !== w.assigneeId &&
      canManageEmployee(s, a, w.assigneeId))
  );
}
export function canEditWork(s: State, a: Actor, w: WorkItem) {
  return (
    canSeeWork(s, a, w) &&
    ["open", "returned"].includes(w.status) &&
    (coordinator(s, a, w) ||
      (w.createdBy === a.uid && w.assigneeId === a.employeeId))
  );
}
export function allowedActions(s: State, a: Actor, w: WorkItem): WorkAction[] {
  if (!canSeeWork(s, a, w)) return [];
  return workActions.filter((action) => {
    if (action === "start")
      return (
        w.assigneeId === a.employeeId && ["open", "returned"].includes(w.status)
      );
    if (action === "submit")
      return w.assigneeId === a.employeeId && w.status === "in_progress";
    if (action === "approve" || action === "return")
      return (
        w.status === "in_review" &&
        a.employeeId !== w.assigneeId &&
        (a.role === "Admin" || w.reviewerId === a.employeeId) &&
        coordinator(s, a, w)
      );
    return (
      !["done", "cancelled"].includes(w.status) &&
      (coordinator(s, a, w) ||
        (w.createdBy === a.uid && w.assigneeId === a.employeeId))
    );
  });
}
export function saveWork(
  s: State,
  a: Actor,
  input: WorkItemInput,
  id?: string,
) {
  requireRole(a, professionalRoles);
  const old = id ? workFor(s, a, id) : undefined;
  if (old) {
    assertVersion(old, input.version);
    assert(
      canEditWork(s, a, old),
      403,
      "WORK_EDIT_FORBIDDEN",
      "Không thể sửa công việc ở trạng thái hoặc phạm vi hiện tại.",
    );
  } else
    assert(
      input.version === 0,
      409,
      "VERSION_CONFLICT",
      "Phiên bản công việc không hợp lệ.",
    );
  assert(
    allowedWorkKinds(a.role).includes(input.kind),
    403,
    "SPECIALTY_FORBIDDEN",
    "Loại công việc không thuộc quyền chuyên môn của bạn.",
  );
  const employee = s.employees[input.assigneeId],
    reviewer = s.employees[input.reviewerId],
    role = employeeRole(s, input.assigneeId),
    reviewerRole = employeeRole(s, input.reviewerId);
  assert(
    employee &&
      employee.status !== "terminated" &&
      s.departments[input.departmentId]?.active &&
      employee.departmentId === input.departmentId,
    400,
    "INVALID_ASSIGNEE",
    "Chọn nhân viên đang làm việc trong phòng ban.",
  );
  assert(
    role &&
      employee.uid &&
      s.memberships[employee.uid]?.active &&
      allowedWorkKinds(role).includes(input.kind),
    400,
    "SPECIALTY_MISMATCH",
    "Người phụ trách chưa có vai trò phù hợp với loại công việc.",
  );
  assert(
    input.assigneeId === a.employeeId ||
      (isSupervisorRole(a.role) && canManageEmployee(s, a, input.assigneeId)),
    403,
    "ASSIGNMENT_FORBIDDEN",
    "Chỉ giao việc cho cấp dưới trong phạm vi phụ trách.",
  );
  assert(
    a.role === "Admin" ||
      input.departmentId === s.employees[a.employeeId].departmentId,
    403,
    "DEPARTMENT_SCOPE",
    "Công việc phải thuộc phòng ban của bạn.",
  );
  assert(
    reviewer &&
      reviewerRole &&
      professionalRoles.includes(reviewerRole) &&
      isSupervisorRole(reviewerRole) &&
      reviewer.status !== "terminated" &&
      input.reviewerId !== input.assigneeId &&
      reviewer.uid,
    400,
    "REVIEWER_REQUIRED",
    "Chọn cấp quản lý chuyên môn để rà soát, khác người thực hiện.",
  );
  const ra: Actor = {
    uid: reviewer.uid,
    employeeId: reviewer.id,
    role: reviewerRole,
    orgId: a.orgId,
  };
  assert(
    s.memberships[reviewer.uid]?.active &&
      canManageEmployee(s, ra, input.assigneeId),
    400,
    "REVIEWER_SCOPE",
    "Người rà soát phải có cấp cao hơn và phụ trách nhân viên này.",
  );
  const w: WorkItem = {
    ...input,
    id: old?.id ?? randomUUID(),
    status: "open",
    version: (old?.version ?? 0) + 1,
    outcome: "",
    evidenceUrl: "",
    createdBy: old?.createdBy ?? a.uid,
    createdAt: old?.createdAt ?? new Date().toISOString(),
    history: [
      ...(old?.history ?? []),
      event(s, a, old ? "work_item_updated" : "work_item_created", input.title),
    ],
  };
  s.workItems[w.id] = w;
  audit(s, a, old ? "professional.updated" : "professional.created", w.id, {
    title: w.title,
    kind: w.kind,
    assignee: employee.name,
  });
  return w;
}
export function transitionWork(
  s: State,
  a: Actor,
  id: string,
  action: WorkAction,
  input: WorkActionInput,
) {
  const w = workFor(s, a, id);
  assertVersion(w, input.version);
  assert(
    allowedActions(s, a, w).includes(action),
    403,
    "WORK_ACTION_FORBIDDEN",
    "Bạn không có quyền thực hiện bước này hoặc trạng thái đã thay đổi.",
  );
  w.status = (
    {
      start: "in_progress",
      submit: "in_review",
      approve: "done",
      return: "returned",
      cancel: "cancelled",
    } as const
  )[action];
  if (action === "submit") {
    w.outcome = input.note;
    w.evidenceUrl = input.evidenceUrl;
  }
  w.version++;
  w.history.push(event(s, a, "work_item_" + action, input.note));
  audit(
    s,
    a,
    "professional." + action,
    w.id,
    { title: w.title, status: w.status },
    input.note,
  );
  return w;
}
export function workView(s: State, a: Actor, w: WorkItem) {
  return {
    ...w,
    assigneeName: s.employees[w.assigneeId]?.name ?? "Nhân viên",
    reviewerName: s.employees[w.reviewerId]?.name ?? "Quản lý",
    canEdit: canEditWork(s, a, w),
    actions: allowedActions(s, a, w),
  };
}
