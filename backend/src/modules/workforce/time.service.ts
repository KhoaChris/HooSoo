import { randomUUID } from "node:crypto";
import type {
  State,
  Actor,
  TimeRequest,
  TimeRequestInput,
  WorkforceAction,
  Schedule,
  TimeRequestView,
} from "@hoosoo/shared";
import { canApprove, isHR } from "../../common/authorization";
import { settings } from "../../common/settings";
import { assert, notFound } from "../../utils/errors";
import { workDates } from "../../utils/time";
import { persistBalance } from "../leave/balances.service";
import {
  allowed,
  change,
  expected,
  record,
  stateIs,
  visible,
  payrollUnlocked,
} from "./core";
export const minutes = (v: string) =>
  Number(v.slice(0, 2)) * 60 + Number(v.slice(3));
export const overlap = (a: number, b: number, c: number, d: number) =>
  Math.max(0, Math.min(b, d) - Math.max(a, c));
export function workingMinutes(
  schedule: Schedule,
  start = schedule.start,
  end = schedule.end,
) {
  return Math.max(
    0,
    minutes(end) -
      minutes(start) -
      overlap(
        minutes(start),
        minutes(end),
        minutes(schedule.breakStart),
        minutes(schedule.breakEnd),
      ),
  );
}
export function pendingDays(
  s: State,
  employeeId: string,
  year: number,
  exclude = "",
) {
  return [
    ...Object.values(s.timeRequests).filter(
      (r) => r.kind === "hourly_leave" && Number(r.date.slice(0, 4)) === year,
    ),
    ...Object.values(s.leaveRequests).filter(
      (r) => Number(r.startDate.slice(0, 4)) === year,
    ),
  ]
    .filter(
      (r) =>
        r.id !== exclude &&
        r.employeeId === employeeId &&
        r.deductsBalance &&
        r.status === "pending",
    )
    .reduce((n, r) => n + r.days, 0);
}
function validateRequest(s: State, r: TimeRequest) {
  assert(
    !Object.values(s.timeRequests).some(
      (x) =>
        x.id !== r.id &&
        x.employeeId === r.employeeId &&
        x.date === r.date &&
        ["pending", "approved"].includes(x.status) &&
        x.start < r.end &&
        x.end > r.start,
    ),
    409,
    "TIME_OVERLAP",
    "Khoảng giờ đã có đề nghị chờ duyệt hoặc được duyệt.",
  );
  assert(
    !Object.values(s.leaveRequests).some(
      (x) =>
        x.employeeId === r.employeeId &&
        ["pending", "approved"].includes(x.status) &&
        x.startDate <= r.date &&
        x.endDate >= r.date,
    ),
    409,
    "LEAVE_OVERLAP",
    "Ngày này đã có đơn nghỉ cả ngày.",
  );
}
export function createTime(s: State, a: Actor, input: TimeRequestInput) {
  const employee = s.employees[a.employeeId];
  allowed(employee && employee.status !== "terminated");
  assert(
    input.date >= employee.hireDate,
    400,
    "TIME_DATE",
    "Ngày đề nghị không được trước ngày vào làm.",
  );
  const schedule = settings(s).schedule,
    work = workDates(input.date, input.date, schedule).length > 0;
  const start = minutes(input.start),
    end = minutes(input.end);
  let duration = end - start,
    days = 0,
    deductsBalance = false;
  if (input.kind === "hourly_leave") {
    assert(
      work && start >= minutes(schedule.start) && end <= minutes(schedule.end),
      400,
      "TIME_HOURS",
      "Chọn giờ nghỉ trong ca làm việc.",
    );
    duration = workingMinutes(schedule, input.start, input.end);
    assert(
      duration > 0 && workingMinutes(schedule) > 0,
      400,
      "TIME_BREAK",
      "Khoảng nghỉ phải có thời gian làm việc, không chỉ gồm giờ nghỉ trưa.",
    );
    const type = s.leaveTypes[input.leaveTypeId];
    assert(
      type?.active,
      400,
      "TIME_TYPE",
      "Chọn loại nghỉ phép đang hoạt động.",
    );
    days = Math.round((duration / workingMinutes(schedule)) * 10000) / 10000;
    deductsBalance = type.deductsBalance;
  } else {
    assert(
      !work || end <= minutes(schedule.start) || start >= minutes(schedule.end),
      400,
      "OVERTIME_HOURS",
      "Tăng ca phải nằm ngoài ca làm việc thông thường.",
    );
    assert(
      duration <= 720,
      400,
      "OVERTIME_LIMIT",
      "Một đề nghị tăng ca tối đa 12 giờ.",
    );
  }
  payrollUnlocked(s, a.employeeId, input.date);
  const r: TimeRequest = {
    ...input,
    ...record(s, a, input.reason),
    employeeId: a.employeeId,
    status: "pending",
    minutes: duration,
    days,
    deductsBalance,
    schedule: structuredClone(schedule),
    reviewedBy: "",
  };
  validateRequest(s, r);
  const approver = Object.values(s.memberships).some(
    (m) =>
      m.active &&
      s.employees[m.employeeId]?.status !== "terminated" &&
      canApprove(
        s,
        { uid: m.id, employeeId: m.employeeId, role: m.role, orgId: m.orgId },
        a.employeeId,
      ),
  );
  assert(
    approver,
    409,
    "NO_ELIGIBLE_APPROVER",
    "Chưa có người duyệt phù hợp. Liên hệ quản trị viên.",
  );
  if (deductsBalance) {
    const year = Number(input.date.slice(0, 4)),
      b = persistBalance(s, a.employeeId, year, a.uid);
    assert(
      b.allowance - b.used - pendingDays(s, a.employeeId, year) + 0.0001 >=
        days,
      409,
      "LEAVE_BALANCE_INSUFFICIENT",
      "Quỹ phép còn lại sau các đơn đang chờ không đủ.",
    );
  }
  s.timeRequests[r.id] = r;
  change(s, a, r, "time_created", input.reason);
  return timeView(s, a, r);
}
export function timeView(s: State, a: Actor, r: TimeRequest): TimeRequestView {
  allowed(visible(s, a, r.employeeId));
  return {
    ...r,
    employeeName: s.employees[r.employeeId].name,
    canReview: r.status === "pending" && canApprove(s, a, r.employeeId),
    canCancel:
      (r.status === "pending" && a.employeeId === r.employeeId) ||
      (r.status === "approved" && isHR(a) && canApprove(s, a, r.employeeId)),
  };
}
export function actTime(
  s: State,
  a: Actor,
  id: string,
  action: string,
  input: WorkforceAction,
) {
  const r = s.timeRequests[id];
  if (!r) notFound();
  const view = timeView(s, a, r);
  expected(r, input.version);
  allowed(action === "cancel" ? view.canCancel : view.canReview);
  stateIs(["approve", "reject", "cancel"].includes(action));
  payrollUnlocked(s, r.employeeId, r.date);
  if (action === "approve") {
    validateRequest(s, r);
    stateIs(s.employees[r.employeeId].status !== "terminated");
  }
  if (
    r.deductsBalance &&
    (action === "approve" || (action === "cancel" && r.status === "approved"))
  ) {
    const year = Number(r.date.slice(0, 4)),
      b = persistBalance(s, r.employeeId, year, a.uid),
      debit = action === "approve";
    assert(
      !debit || b.allowance - b.used + 0.0001 >= r.days,
      409,
      "LEAVE_BALANCE_INSUFFICIENT",
      "Số ngày phép còn lại không đủ.",
    );
    const used =
      Math.round((b.used + (debit ? r.days : -r.days)) * 10000) / 10000;
    stateIs(used >= 0);
    b.used = used;
    const tid = randomUUID();
    s.leaveBalanceTransactions[tid] = {
      id: tid,
      employeeId: r.employeeId,
      year,
      amount: debit ? -r.days : r.days,
      kind: debit ? "debit" : "refund",
      requestId: r.id,
      reason: input.reason,
      actorId: a.uid,
      createdAt: new Date().toISOString(),
    };
  }
  r.status =
    action === "approve"
      ? "approved"
      : action === "reject"
        ? "rejected"
        : "cancelled";
  r.reviewedBy = a.uid;
  change(s, a, r, `time_${action}`, input.reason);
  return timeView(s, a, r);
}
