import { randomUUID } from "node:crypto";
import type {
  Actor,
  State,
  WorkRegistrationInput,
  InternalRequestInput,
  ApprovalRecord,
  WorkRegistration,
  InternalRequest,
} from "@hoosoo/shared";
import { assert, notFound } from "../../utils/errors";
import { settings } from "../../common/settings";
import { audit } from "../../common/audit";
import { businessDate, clockAt, workDates } from "../../utils/time";
import { adjustAttendance } from "../attendance/attendance.service";
import {
  beginApproval,
  assertVersion,
  cancel,
  review,
  managerFor,
} from "./approval";
const pending = (r: ApprovalRecord) =>
  !["rejected", "cancelled"].includes(r.status);
function noLeave(s: State, employeeId: string, dates: string[]) {
  assert(
    !Object.values(s.leaveRequests).some(
      (l) =>
        l.employeeId === employeeId &&
        l.status === "approved" &&
        l.workDates.some((d) => dates.includes(d)),
    ),
    409,
    "LEAVE_CONFLICT",
    "Thời gian này trùng với nghỉ phép đã được duyệt.",
  );
}
function validWork(s: State, input: WorkRegistrationInput, now = new Date()) {
  const schedule = settings(s).schedule;
  assert(
    input.date >= businessDate(now) &&
      Date.parse(input.date) - Date.parse(businessDate(now)) <= 366 * 86400000,
    400,
    "REGISTRATION_DATE",
    "Chỉ đăng ký từ hôm nay trong vòng 12 tháng tới.",
  );
  assert(
    workDates(input.date, input.date, schedule).length === 1,
    400,
    "NON_WORKING_DAY",
    "Ngày này là ngày nghỉ theo chính sách doanh nghiệp.",
  );
  assert(
    input.start >= schedule.start &&
      input.end <= schedule.end &&
      input.start < input.end,
    400,
    "OUTSIDE_WORK_HOURS",
    "Thời gian đăng ký phải nằm trong ca làm việc chính quy.",
  );
  assert(
    input.start < schedule.breakStart || input.end > schedule.breakEnd,
    400,
    "BREAK_ONLY",
    "Khoảng đăng ký cần có thời gian làm việc ngoài giờ nghỉ giữa ca.",
  );
  assert(
    clockAt(input.date, input.end) > now.getTime(),
    400,
    "PAST_REGISTRATION",
    "Khoảng thời gian đăng ký đã kết thúc.",
  );
}
export function registerWork(s: State, a: Actor, input: WorkRegistrationInput) {
  validWork(s, input);
  noLeave(s, a.employeeId, [input.date]);
  const id = `${a.employeeId}_${input.date}`,
    old = s.workRegistrations[id];
  if (old) {
    assertVersion(old, input.version);
    assert(
      old.employeeId === a.employeeId && old.status !== "approved",
      409,
      "SCHEDULE_LOCKED",
      "Lịch đã duyệt không thể sửa. Hãy gửi phiếu đề nghị cho nhân sự.",
    );
  } else
    assert(
      input.version === 0,
      409,
      "VERSION_CONFLICT",
      "Lịch đã thay đổi. Vui lòng mở lại ngày đăng ký.",
    );
  const approval = beginApproval(s, a);
  const record: WorkRegistration = {
    ...approval,
    id,
    date: input.date,
    start: input.start,
    end: input.end,
    reason: input.reason,
    schedule: structuredClone(settings(s).schedule),
    version: (old?.version ?? 0) + 1,
    history: [...(old?.history ?? []), ...approval.history],
  };
  s.workRegistrations[id] = record;
  audit(
    s,
    a,
    "work.submitted",
    id,
    { date: input.date, start: input.start, end: input.end },
    input.reason,
  );
  return record;
}
export function createInternalRequest(
  s: State,
  a: Actor,
  input: InternalRequestInput,
) {
  const today = businessDate();
  let attendanceBefore: InternalRequest["attendanceBefore"] = null;
  if (input.kind === "attendance_correction") {
    assert(
      input.startDate === input.endDate &&
        input.startDate <= today &&
        input.checkIn &&
        input.checkOut &&
        input.checkIn < input.checkOut,
      400,
      "ATTENDANCE_INPUT",
      "Chọn một ngày đã làm việc, giờ vào và giờ ra hợp lệ.",
    );
    const row = s.attendanceRecords[`${a.employeeId}_${input.startDate}`];
    assert(
      row,
      409,
      "ATTENDANCE_REQUIRED",
      "Chưa có bản ghi chấm công ngày này. Liên hệ nhân sự để xác minh trước.",
    );
    assert(
      clockAt(input.startDate, input.checkOut) <= Date.now(),
      400,
      "FUTURE_ATTENDANCE",
      "Không đề nghị chấm công ở thời điểm tương lai.",
    );
    attendanceBefore = { checkIn: row.checkIn, checkOut: row.checkOut };
  } else {
    assert(
      input.startDate >= today,
      400,
      "PAST_REQUEST",
      "Chọn ngày từ hôm nay trở đi.",
    );
    if (input.kind !== "employment_certificate") {
      assert(
        input.location.length >= 3,
        400,
        "LOCATION_REQUIRED",
        "Nhập địa điểm làm việc hoặc công tác.",
      );
      const days = workDates(
        input.startDate,
        input.endDate,
        settings(s).schedule,
      );
      assert(
        days.length > 0,
        400,
        "NON_WORKING_DAY",
        "Khoảng này không có ngày làm việc.",
      );
      noLeave(s, a.employeeId, days);
    }
  }
  assert(
    !Object.values(s.internalRequests).some(
      (r) =>
        r.employeeId === a.employeeId &&
        r.kind === input.kind &&
        pending(r) &&
        r.startDate <= input.endDate &&
        r.endDate >= input.startDate,
    ),
    409,
    "DUPLICATE_REQUEST",
    "Đã có đề nghị cùng loại trong khoảng thời gian này.",
  );
  const record: InternalRequest = {
    ...beginApproval(s, a),
    ...input,
    id: randomUUID(),
    attendanceBefore,
    resolution: "",
  };
  s.internalRequests[record.id] = record;
  audit(
    s,
    a,
    "request.submitted",
    record.id,
    { kind: input.kind, title: input.title },
    input.reason,
  );
  return record;
}
export function actOnWorkflow(
  s: State,
  a: Actor,
  table: "workRegistrations" | "internalRequests",
  id: string,
  operation: "approve" | "reject" | "cancel",
  input: { version: number; reason: string },
) {
  const r = s[table][id];
  if (!r) notFound();
  if (operation === "cancel") cancel(s, a, r, input);
  else {
    // Validate final effects before changing state; all effects commit atomically.
    const final =
      operation === "approve" &&
      (r.status === "pending_hr" || !managerFor(s, r.employeeId));
    if (final && table === "workRegistrations") {
      const w = r as WorkRegistration;
      validWork(s, w);
      noLeave(s, w.employeeId, [w.date]);
    }
    if (final && table === "internalRequests") {
      const req = r as InternalRequest;
      if (req.kind === "attendance_correction") {
        const attendance =
          s.attendanceRecords[`${req.employeeId}_${req.startDate}`];
        assert(
          attendance &&
            JSON.stringify({
              checkIn: attendance.checkIn,
              checkOut: attendance.checkOut,
            }) === JSON.stringify(req.attendanceBefore),
          409,
          "ATTENDANCE_CHANGED",
          "Chấm công đã được điều chỉnh sau khi gửi đơn. Nhân viên cần tạo đề nghị mới.",
        );
      } else if (req.kind !== "employment_certificate")
        noLeave(
          s,
          req.employeeId,
          workDates(req.startDate, req.endDate, settings(s).schedule),
        );
    }
    review(s, a, r, input, operation === "approve");
    if (r.status === "approved" && table === "internalRequests") {
      const req = r as InternalRequest;
      req.resolution = input.reason;
      if (req.kind === "attendance_correction")
        adjustAttendance(s, a, `${req.employeeId}_${req.startDate}`, {
          checkIn: new Date(clockAt(req.startDate, req.checkIn)).toISOString(),
          checkOut: new Date(
            clockAt(req.startDate, req.checkOut),
          ).toISOString(),
          reason: input.reason,
        });
    }
  }
  audit(
    s,
    a,
    `${table === "workRegistrations" ? "work" : "request"}.${operation}`,
    id,
    { status: r.status },
    input.reason,
  );
  return r;
}
