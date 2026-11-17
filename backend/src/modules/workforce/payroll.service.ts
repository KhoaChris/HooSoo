import type {
  State,
  Actor,
  PayrollSource,
  PayrollSetup,
  PayrollStatement,
  PayrollView,
  WorkforceAction,
} from "@hoosoo/shared";
import { employeeRole } from "../../common/authorization";
import { settings } from "../../common/settings";
import {
  workDates,
  businessDate,
  attendanceMetrics,
  clockAt,
} from "../../utils/time";
import { assert, notFound } from "../../utils/errors";
import {
  allowed,
  change,
  digest,
  expected,
  payManage,
  payRead,
  record,
  stateIs,
} from "./core";
import { overlap } from "./time.service";
export function monthBounds(period: string) {
  const [year, month] = period.split("-").map(Number);
  return {
    start: period + "-01",
    end: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10),
  };
}
export function payrollSource(
  s: State,
  employeeId: string,
  period: string,
): PayrollSource {
  const e = s.employees[employeeId];
  if (!e) notFound();
  const { start, end } = monthBounds(period),
    schedule = settings(s).schedule,
    dates = workDates(start, end, schedule);
  assert(
    dates.length > 0,
    409,
    "PAYROLL_SCHEDULE",
    "Kỳ này chưa có ngày công chuẩn.",
  );
  const exit = Object.values(s.employeeServices).find(
    (x) =>
      x.employeeId === employeeId &&
      x.section === "offboarding" &&
      x.status === "completed",
  )?.endDate;
  assert(
    e.status !== "terminated" || exit,
    409,
    "PAYROLL_END_DATE",
    "Cần hồ sơ bàn giao hoàn tất để xác định ngày nghỉ việc.",
  );
  const employmentDates = dates.filter(
    (d) => d >= e.hireDate && (!exit || d <= exit),
  );
  assert(
    employmentDates.length > 0,
    409,
    "PAYROLL_NO_EMPLOYMENT",
    "Nhân viên không có ngày làm việc trong kỳ này.",
  );
  const compensation = Object.values(s.compensationRecords)
    .filter((r) => r.employeeId === employeeId && r.status === "published")
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
  const bands = Object.values(s.compensationBands)
    .filter((b) => b.id !== "Admin")
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  let baseAmount = 0,
    allowanceAmount = 0;
  const sourceIds = new Map<
    string,
    { id: string; version: number; kind: string }
  >();
  for (const date of employmentDates) {
    const comp = compensation.find((c) => c.effectiveDate <= date),
      band =
        employeeRole(s, employeeId) === "Admin"
          ? bands.find((b) => (b.createdAt ?? "").slice(0, 10) <= date)
          : undefined,
      pack = band?.package ?? comp?.package;
    assert(
      pack,
      409,
      "PAYROLL_NO_SALARY",
      "Thiếu mức lương có hiệu lực trong kỳ. Cập nhật hồ sơ lương trước khi tính.",
    );
    const probation = Object.values(s.probationReviews).some(
      (p) =>
        p.employeeId === employeeId && date >= p.startDate && date <= p.endDate,
    );
    baseAmount +=
      (probation
        ? (pack.probationSalary ?? pack.baseSalary)
        : pack.baseSalary) / dates.length;
    allowanceAmount +=
      pack.allowances.reduce((n, v) => n + v.amount, 0) / dates.length;
    const src = band ?? comp!;
    sourceIds.set(src.id, {
      id: src.id,
      version: src.version,
      kind: band ? "admin_band" : "compensation",
    });
  }
  const att = Object.values(s.attendanceRecords).filter(
    (r) => r.employeeId === employeeId && r.date >= start && r.date <= end,
  );
  const leaves = Object.values(s.leaveRequests).filter(
    (r) =>
      r.employeeId === employeeId &&
      r.status === "approved" &&
      r.startDate <= end &&
      r.endDate >= start,
  );
  const time = Object.values(s.timeRequests).filter(
    (r) =>
      r.employeeId === employeeId &&
      r.status === "approved" &&
      r.date >= start &&
      r.date <= end,
  );
  const overtimeMinutes = time
    .filter((r) => r.kind === "overtime")
    .reduce(
      (n, r) =>
        n +
        att
          .filter((at) => at.date === r.date && at.checkOut)
          .reduce(
            (m, at) =>
              m +
              overlap(
                Date.parse(at.checkIn),
                Date.parse(at.checkOut!),
                clockAt(r.date, r.start),
                clockAt(r.date, r.end),
              ) /
                60000,
            0,
          ),
      0,
    );
  const core = {
    baseAmount: Math.round(baseAmount),
    allowanceAmount: Math.round(allowanceAmount),
    scheduledDays: dates.length,
    employmentDays: employmentDates.length,
    attendanceMinutes: att.reduce(
      (n, r) => n + (attendanceMetrics(r).paidMinutes ?? 0),
      0,
    ),
    paidLeaveDays: leaves
      .filter((r) => r.deductsBalance)
      .reduce(
        (n, r) =>
          n + r.workDates.filter((d) => employmentDates.includes(d)).length,
        0,
      ),
    overtimeMinutes: Math.floor(overtimeMinutes),
    hourlyLeaveMinutes: time
      .filter((r) => r.kind === "hourly_leave")
      .reduce((n, r) => n + r.minutes, 0),
    missingAttendanceDates: employmentDates.filter(
      (d) =>
        !att.some((r) => r.date === d && r.checkOut) &&
        !leaves.some((r) => r.workDates.includes(d)),
    ),
    sources: [
      ...sourceIds.values(),
      ...time.map((r) => ({ id: r.id, version: r.version, kind: r.kind })),
    ],
  };
  return {
    ...core,
    fingerprint: digest({
      core,
      employee: { hireDate: e.hireDate, status: e.status, exit: exit ?? "" },
      schedule,
      att: att.sort((a, b) => a.id.localeCompare(b.id)),
      leaves: leaves.sort((a, b) => a.id.localeCompare(b.id)),
      time: time.sort((a, b) => a.id.localeCompare(b.id)),
    }),
  };
}
export function payrollActions(s: State, a: Actor, r: PayrollStatement) {
  if (!payManage(s, a, r.employeeId)) return [];
  return r.status === "draft"
    ? ["edit", "submit", "void"]
    : r.status === "review"
      ? [
          "return",
          ...((r.preparedBy ?? r.createdBy) !== a.uid ? ["approve"] : []),
          "void",
        ]
      : r.status === "approved"
        ? ["publish", "void"]
        : r.status === "published"
          ? ["void"]
          : ["reissue"];
}
export function payrollView(
  s: State,
  a: Actor,
  r: PayrollStatement,
): PayrollView {
  allowed(payRead(s, a, r.employeeId));
  allowed(
    payManage(s, a, r.employeeId) || ["published", "voided"].includes(r.status),
  );
  return {
    ...r,
    employeeName: s.employees[r.employeeId].name,
    actions: payrollActions(s, a, r),
  };
}
export function savePayroll(s: State, a: Actor, input: PayrollSetup) {
  allowed(payManage(s, a, input.employeeId));
  const id = input.employeeId + "_" + input.period,
    old = s.payrollStatements[id];
  expected(old, input.version);
  stateIs(!old || old.status === "draft");
  const source = payrollSource(s, input.employeeId, input.period);
  const totalEarnings =
      source.baseAmount +
      source.allowanceAmount +
      Math.round((source.overtimeMinutes / 60) * input.overtimeRate) +
      input.earnings.reduce((n, v) => n + v.amount, 0),
    totalDeductions = input.deductions.reduce((n, v) => n + v.amount, 0);
  assert(
    totalDeductions <= totalEarnings,
    400,
    "PAYROLL_NEGATIVE",
    "Tổng khấu trừ không được vượt tổng thu nhập.",
  );
  const r: PayrollStatement = {
    ...(old ?? record(s, a, input.reason, id)),
    ...input,
    preparedBy: a.uid,
    source,
    totalEarnings,
    totalDeductions,
    netAmount: totalEarnings - totalDeductions,
    status: "draft",
    approvedBy: "",
    publishedAt: "",
    revisions: old?.revisions ?? [],
  };
  s.payrollStatements[id] = r;
  change(s, a, r, "payroll_saved", input.reason);
  return payrollView(s, a, r);
}
export function actPayroll(
  s: State,
  a: Actor,
  id: string,
  action: string,
  input: WorkforceAction,
) {
  const r = s.payrollStatements[id];
  if (!r) notFound();
  allowed(payrollActions(s, a, r).includes(action));
  expected(r, input.version);
  if (["submit", "approve", "publish"].includes(action)) {
    const bounds = monthBounds(r.period);
    assert(
      !Object.values(s.timeRequests).some(
        (x) =>
          x.employeeId === r.employeeId &&
          x.status === "pending" &&
          x.date >= bounds.start &&
          x.date <= bounds.end,
      ) &&
        !Object.values(s.leaveRequests).some(
          (x) =>
            x.employeeId === r.employeeId &&
            x.status === "pending" &&
            x.startDate <= bounds.end &&
            x.endDate >= bounds.start,
        ),
      409,
      "PAYROLL_PENDING_TIME",
      "Cần xử lý các đơn thời gian còn chờ trong kỳ trước khi chốt lương.",
    );
    assert(
      monthBounds(r.period).end < businessDate(),
      409,
      "PAYROLL_PERIOD_OPEN",
      "Chỉ chốt kỳ lương sau khi tháng đã kết thúc.",
    );
    assert(
      payrollSource(s, r.employeeId, r.period).fingerprint ===
        r.source.fingerprint,
      409,
      "PAYROLL_SOURCE_CHANGED",
      "Dữ liệu công, phép hoặc lương đã thay đổi. Trả về nháp và tính lại trước khi duyệt.",
    );
  }
  if (action === "submit") r.status = "review";
  else if (action === "return") r.status = "draft";
  else if (action === "approve") {
    r.status = "approved";
    r.approvedBy = a.uid;
  } else if (action === "publish") {
    r.status = "published";
    r.publishedAt = new Date().toISOString();
  } else if (action === "void") r.status = "voided";
  else if (action === "reissue") {
    r.revisions.push({
      version: r.version,
      netAmount: r.netAmount,
      source: structuredClone(r.source),
      reason: input.reason,
      at: new Date().toISOString(),
    });
    r.status = "draft";
    r.preparedBy = a.uid;
    r.approvedBy = "";
    r.publishedAt = "";
  }
  change(s, a, r, `payroll_${action}`, input.reason);
  return payrollView(s, a, r);
}
