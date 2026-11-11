import type { Schedule, Attendance } from "@hoosoo/shared";
export function businessDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function workDates(start: string, end: string, s: Schedule) {
  const dates: string[] = [];
  for (
    let d = new Date(start + "T00:00:00Z");
    d.toISOString().slice(0, 10) <= end;
    d = new Date(d.getTime() + 86400000)
  ) {
    const key = d.toISOString().slice(0, 10);
    if (s.workDays.includes(d.getUTCDay()) && !s.holidays.includes(key))
      dates.push(key);
  }
  return dates;
}
export function clockAt(date: string, clock: string) {
  return Date.parse(`${date}T${clock}:00+07:00`);
}
export function attendanceMetrics(a: Attendance, now = new Date()) {
  const start = Date.parse(a.checkIn),
    end = a.checkOut ? Date.parse(a.checkOut) : null;
  const overlap = (a: number, b: number, c: number, d: number) =>
    Math.max(0, Math.min(b, d) - Math.max(a, c));
  const presence = end === null ? null : Math.max(0, (end - start) / 60000);
  const scheduledDay =
    a.schedule.workDays.includes(new Date(a.date + "T00:00:00Z").getUTCDay()) &&
    !a.schedule.holidays.includes(a.date);
  const payable =
    end === null
      ? null
      : !scheduledDay
        ? 0
        : Math.max(
            0,
            (overlap(
              start,
              end,
              clockAt(a.date, a.schedule.start),
              clockAt(a.date, a.schedule.end),
            ) -
              overlap(
                Math.max(start, clockAt(a.date, a.schedule.start)),
                Math.min(end, clockAt(a.date, a.schedule.end)),
                clockAt(a.date, a.schedule.breakStart),
                clockAt(a.date, a.schedule.breakEnd),
              )) /
              60000,
          );
  const late =
    scheduledDay &&
    start >
      clockAt(a.date, a.schedule.start) + a.schedule.lateGraceMinutes * 60000;
  return {
    presenceMinutes: presence,
    paidMinutes: payable,
    status: !a.checkOut
      ? now.getTime() > clockAt(a.date, a.schedule.end)
        ? "missing_checkout"
        : "working"
      : late
        ? "late"
        : "on_time",
    late,
  };
}
export function csv(rows: Record<string, unknown>[]) {
  const keys = Object.keys(rows[0] || {});
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[\s]*[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return (
    "\ufeff" +
    [keys, ...rows.map((r) => keys.map((k) => r[k]))]
      .map((r) => r.map(cell).join(","))
      .join("\r\n")
  );
}
