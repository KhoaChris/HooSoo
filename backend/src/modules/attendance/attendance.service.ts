import type {
  State,
  Actor,
  Attendance,
  attendanceAdjustmentSchema,
} from "@hoosoo/shared";
import type { z } from "zod";
import { assert, notFound } from "../../utils/errors";
import { audit } from "../../common/audit";
import { settings } from "../../common/settings";
import { requireRole } from "../../common/authorization";
import { businessDate } from "../../utils/time";

export function checkIn(s: State, a: Actor, now = new Date()) {
  const date = businessDate(now),
    id = a.employeeId + "_" + date;
  if (s.attendanceRecords[id]) return s.attendanceRecords[id];
  const record: Attendance = {
    id,
    employeeId: a.employeeId,
    date,
    checkIn: now.toISOString(),
    checkOut: null,
    schedule: structuredClone(settings(s).schedule),
    adjustments: [],
  };
  s.attendanceRecords[id] = record;
  audit(s, a, "attendance.check_in", id, { checkIn: record.checkIn });
  return record;
}
export function checkOut(s: State, a: Actor, now = new Date()) {
  const id = a.employeeId + "_" + businessDate(now),
    r = s.attendanceRecords[id];
  assert(r, 409, "CHECK_IN_REQUIRED", "Bạn cần vào ca trước khi kết thúc ca.");
  if (r.checkOut) return r;
  assert(
    now.getTime() >= Date.parse(r.checkIn),
    409,
    "INVALID_TIME_ORDER",
    "Giờ ra không thể trước giờ vào.",
  );
  r.checkOut = now.toISOString();
  audit(s, a, "attendance.check_out", id, { checkOut: r.checkOut });
  return r;
}
export function adjustAttendance(
  s: State,
  a: Actor,
  id: string,
  input: z.infer<typeof attendanceAdjustmentSchema>,
) {
  requireRole(a, ["Admin", "HR"]);
  const r = s.attendanceRecords[id];
  if (!r) notFound();
  assert(
    businessDate(new Date(input.checkIn)) === r.date &&
      (!input.checkOut || businessDate(new Date(input.checkOut)) === r.date),
    400,
    "SAME_DAY_REQUIRED",
    "Chỉ hỗ trợ chấm công trong cùng ngày.",
  );
  assert(
    !input.checkOut || Date.parse(input.checkOut) >= Date.parse(input.checkIn),
    400,
    "INVALID_TIME_ORDER",
    "Giờ ra không thể trước giờ vào.",
  );
  assert(
    Date.parse(input.checkIn) <= Date.now() &&
      (!input.checkOut || Date.parse(input.checkOut) <= Date.now()),
    400,
    "FUTURE_ATTENDANCE",
    "Không điều chỉnh sang thời điểm trong tương lai.",
  );
  const before = { checkIn: r.checkIn, checkOut: r.checkOut };
  const after = {
    checkIn: new Date(input.checkIn).toISOString(),
    checkOut: input.checkOut ? new Date(input.checkOut).toISOString() : null,
  };
  r.adjustments.push({
    at: new Date().toISOString(),
    by: a.uid,
    reason: input.reason,
    before,
    after,
  });
  Object.assign(r, after);
  audit(s, a, "attendance.adjusted", id, { before, after }, input.reason);
  return r;
}
