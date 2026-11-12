import { isSupervisorRole, outranks } from "@hoosoo/shared";
import { canManageEmployee, employeeRole } from "../../common/authorization";
import type {
  Actor,
  ApprovalRecord,
  ApprovalView,
  State,
  WorkflowEvent,
} from "@hoosoo/shared";
import { isHR, inScope } from "../../common/authorization";
import { assert } from "../../utils/errors";
export function event(
  s: State,
  a: Actor,
  action: string,
  reason: string,
): WorkflowEvent {
  return {
    action,
    reason,
    at: new Date().toISOString(),
    by: a.uid,
    name: s.employees[a.employeeId]?.name ?? "Người thực hiện",
  };
}
export function managerFor(s: State, employeeId: string) {
  const employee = s.employees[employeeId],
    manager = s.employees[employee?.managerId];
  return manager &&
    manager.id !== employeeId &&
    manager.status !== "terminated" &&
    manager.departmentId === employee.departmentId &&
    Object.values(s.memberships).some(
      (m) =>
        m.employeeId === manager.id &&
        m.active &&
        isSupervisorRole(m.role) &&
        !!employeeRole(s, employeeId) &&
        outranks(m.role, employeeRole(s, employeeId)!),
    )
    ? manager.id
    : "";
}
export function beginApproval(s: State, a: Actor): Omit<ApprovalRecord, "id"> {
  const managerId = managerFor(s, a.employeeId);
  const finalReviewer = Object.values(s.memberships).some(
    (m) =>
      m.active &&
      ["Admin", "HR"].includes(m.role) &&
      m.employeeId !== a.employeeId &&
      m.employeeId !== managerId &&
      s.employees[m.employeeId]?.status !== "terminated" &&
      canManageEmployee(
        s,
        { uid: m.id, employeeId: m.employeeId, role: m.role, orgId: m.orgId },
        a.employeeId,
      ),
  );
  assert(
    finalReviewer,
    409,
    "NO_ELIGIBLE_APPROVER",
    "Chưa có cấp xác nhận cuối phù hợp. Liên hệ Admin để phân công người duyệt khác; người gửi không được tự duyệt.",
  );
  if (managerId)
    assert(
      Object.values(s.memberships).some(
        (m) =>
          m.employeeId === managerId && m.active && isSupervisorRole(m.role),
      ),
      409,
      "MANAGER_UNAVAILABLE",
      "Quản lý trực tiếp chưa có quyền duyệt. Liên hệ nhân sự cập nhật hồ sơ quản lý.",
    );
  return {
    employeeId: a.employeeId,
    managerId,
    managerApprovedBy: "",
    status: managerId ? "pending_manager" : "pending_hr",
    version: 1,
    createdBy: a.uid,
    createdAt: new Date().toISOString(),
    history: [event(s, a, "submitted", "")],
  };
}
export function canReview(s: State, a: Actor, r: ApprovalRecord) {
  if (a.employeeId === r.employeeId || !canManageEmployee(s, a, r.employeeId))
    return false;
  if (r.status === "pending_manager") {
    const manager = managerFor(s, r.employeeId);
    return manager
      ? manager === a.employeeId && isSupervisorRole(a.role)
      : isHR(a);
  }
  return r.status === "pending_hr" && isHR(a) && r.managerApprovedBy !== a.uid;
}
export function assertVersion(r: { version: number }, version: number) {
  assert(
    r.version === version,
    409,
    "VERSION_CONFLICT",
    "Hồ sơ vừa được cập nhật. Hãy đóng và mở lại để xem nội dung mới nhất.",
  );
}
export function review(
  s: State,
  a: Actor,
  r: ApprovalRecord,
  input: { version: number; reason: string },
  approve: boolean,
) {
  assertVersion(r, input.version);
  assert(
    !approve || s.employees[r.employeeId]?.status !== "terminated",
    409,
    "EMPLOYEE_INACTIVE",
    "Không phê duyệt đề nghị của nhân viên đã nghỉ việc.",
  );
  assert(
    canReview(s, a, r),
    403,
    "APPROVAL_FORBIDDEN",
    "Bạn không thuộc cấp duyệt hiện tại hoặc đang xử lý đề nghị của chính mình.",
  );
  if (!approve) r.status = "rejected";
  else if (r.status === "pending_manager" && managerFor(s, r.employeeId)) {
    r.status = "pending_hr";
    r.managerApprovedBy = a.uid;
  } else r.status = "approved";
  r.version++;
  r.history.push(
    event(
      s,
      a,
      !approve
        ? "rejected"
        : r.status === "pending_hr"
          ? "manager_approved"
          : "approved_final",
      input.reason,
    ),
  );
}
export function approvalView(
  s: State,
  a: Actor,
  r: ApprovalRecord,
): ApprovalView {
  const e = s.employees[r.employeeId];
  return {
    employeeName: e?.name ?? "Nhân viên",
    employeeCode: e?.employeeCode ?? "",
    managerName:
      s.employees[managerFor(s, r.employeeId)]?.name ??
      "Nhân sự / Quản trị viên",
    canReview: canReview(s, a, r),
    canCancel:
      r.employeeId === a.employeeId &&
      ["pending_manager", "pending_hr"].includes(r.status),
  };
}
export function visible(
  s: State,
  a: Actor,
  r: ApprovalRecord,
  approvals = false,
) {
  const e = s.employees[r.employeeId];
  return (
    !!e &&
    (approvals
      ? isSupervisorRole(a.role) &&
        inScope(s, a, e) &&
        r.employeeId !== a.employeeId
      : r.employeeId === a.employeeId)
  );
}
export function cancel(
  s: State,
  a: Actor,
  r: ApprovalRecord,
  input: { version: number; reason: string },
) {
  assertVersion(r, input.version);
  assert(
    approvalView(s, a, r).canCancel,
    403,
    "CANCEL_FORBIDDEN",
    "Chỉ người gửi được rút đề nghị đang chờ duyệt.",
  );
  r.status = "cancelled";
  r.version++;
  r.history.push(event(s, a, "cancelled", input.reason));
}
