import { assertManageEmployee } from "../../common/authorization";
import { randomUUID } from "node:crypto";
import type { State, Actor, LeaveRequest, leaveSchema } from "@hoosoo/shared";
import type { z } from "zod";
import { assert, notFound } from "../../utils/errors";
import { audit } from "../../common/audit";
import { settings } from "../../common/settings";
import {
  canApprove,
  requireRole,
  isHR,
  scopedEmployee,
} from "../../common/authorization";
import { workDates } from "../../utils/time";
import { persistBalance } from "./balances.service";

export function createLeave(
  s: State,
  a: Actor,
  input: z.infer<typeof leaveSchema>,
) {
  assert(
    input.endDate >= input.startDate,
    400,
    "INVALID_DATE_RANGE",
    "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.",
  );
  assert(
    input.startDate.slice(0, 4) === input.endDate.slice(0, 4),
    400,
    "CROSS_YEAR_LEAVE",
    "Vui lòng tách yêu cầu theo từng năm.",
  );
  assert(
    Number(input.startDate.slice(0, 4)) >= 2020 &&
      Number(input.startDate.slice(0, 4)) <= 2100,
    400,
    "INVALID_LEAVE_YEAR",
    "Năm nghỉ phép phải từ 2020 đến 2100.",
  );
  const type = s.leaveTypes[input.leaveTypeId];
  assert(
    type?.active,
    400,
    "LEAVE_TYPE_DISABLED",
    "Loại phép không còn hoạt động.",
  );
  const days = workDates(input.startDate, input.endDate, settings(s).schedule);
  assert(
    days.length > 0,
    400,
    "NO_WORKING_DAYS",
    "Khoảng ngày không có ngày làm việc.",
  );
  assert(
    !Object.values(s.leaveRequests).some(
      (r) =>
        r.employeeId === a.employeeId &&
        ["pending", "approved"].includes(r.status) &&
        r.startDate <= input.endDate &&
        r.endDate >= input.startDate,
    ),
    409,
    "LEAVE_OVERLAP",
    "Khoảng ngày đã có đơn chờ duyệt hoặc được duyệt.",
  );
  const approvers = Object.values(s.memberships)
    .filter(
      (m) =>
        m.active &&
        !!s.employees[m.employeeId] &&
        s.employees[m.employeeId].status !== "terminated",
    )
    .some((m) =>
      canApprove(
        s,
        { uid: m.id, employeeId: m.employeeId, role: m.role, orgId: m.orgId },
        a.employeeId,
      ),
    );
  assert(
    approvers,
    409,
    "NO_ELIGIBLE_APPROVER",
    "Chưa có người có quyền duyệt đơn của bạn. Cần quản trị viên cấu hình người duyệt khác.",
  );
  const year = Number(input.startDate.slice(0, 4));
  persistBalance(s, a.employeeId, year, a.uid);
  const r: LeaveRequest = {
    ...input,
    id: randomUUID(),
    employeeId: a.employeeId,
    typeName: type.name,
    deductsBalance: type.deductsBalance,
    days: days.length,
    workDates: days,
    status: "pending",
    createdAt: new Date().toISOString(),
    history: [
      {
        action: "created",
        at: new Date().toISOString(),
        by: a.uid,
        reason: input.reason,
      },
    ],
  };
  s.leaveRequests[r.id] = r;
  audit(s, a, "leave.created", r.id, {
    days: r.days,
    startDate: r.startDate,
    endDate: r.endDate,
  });
  return r;
}
export function transitionLeave(
  s: State,
  a: Actor,
  id: string,
  action: "approve" | "reject" | "cancel",
  reason = "",
) {
  const r = s.leaveRequests[id];
  if (!r) notFound();
  scopedEmployee(s, a, r.employeeId);
  if (r.employeeId !== a.employeeId || r.status === "approved")
    assertManageEmployee(s, a, r.employeeId);
  if (action === "approve" || action === "reject") {
    assert(
      a.employeeId !== r.employeeId,
      403,
      "SELF_APPROVAL_FORBIDDEN",
      "Không được tự duyệt hoặc từ chối đơn của mình.",
    );
    assert(
      canApprove(s, a, r.employeeId),
      403,
      "FORBIDDEN",
      "Bạn không có quyền xử lý đơn này.",
    );
  } else
    assert(
      r.employeeId === a.employeeId || isHR(a),
      403,
      "FORBIDDEN",
      "Bạn không có quyền hủy đơn này.",
    );
  const target = {
    approve: "approved",
    reject: "rejected",
    cancel: "cancelled",
  }[action] as LeaveRequest["status"];
  if (r.status === target) return r;
  assert(
    (action === "cancel" && ["pending", "approved"].includes(r.status)) ||
      (action !== "cancel" && r.status === "pending"),
    409,
    "INVALID_LEAVE_STATE",
    "Trạng thái đơn đã thay đổi. Vui lòng tải lại.",
  );
  if (action === "reject" || (action === "cancel" && r.status === "approved"))
    assert(
      reason.trim().length >= 5,
      400,
      "REASON_REQUIRED",
      "Cần nhập lý do ít nhất 5 ký tự.",
    );
  if (action === "cancel" && r.status === "approved")
    requireRole(a, ["Admin", "HR"]);
  const year = Number(r.startDate.slice(0, 4));
  const b = persistBalance(s, r.employeeId, year, a.uid);
  if (
    r.deductsBalance &&
    (action === "approve" || (action === "cancel" && r.status === "approved"))
  ) {
    const debit = action === "approve";
    if (debit)
      assert(
        b.allowance - b.used >= r.days,
        409,
        "LEAVE_BALANCE_INSUFFICIENT",
        "Số ngày phép còn lại không đủ.",
      );
    b.used += debit ? r.days : -r.days;
    assert(
      b.used >= 0,
      409,
      "BALANCE_INCONSISTENT",
      "Số dư phép không nhất quán.",
    );
    const tId = randomUUID();
    s.leaveBalanceTransactions[tId] = {
      id: tId,
      employeeId: r.employeeId,
      year,
      amount: debit ? -r.days : r.days,
      kind: debit ? "debit" : "refund",
      requestId: r.id,
      reason: reason || "Duyệt đơn nghỉ phép",
      actorId: a.uid,
    };
  }
  r.status = target;
  r.history.push({ action, at: new Date().toISOString(), by: a.uid, reason });
  audit(
    s,
    a,
    "leave." + action,
    r.id,
    { status: target, days: r.days },
    reason,
  );
  return r;
}
