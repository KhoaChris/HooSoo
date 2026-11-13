export type PickerType = "date" | "time" | "datetime-local";
export const pad = (value: number) => String(value).padStart(2, "0");

// Calendar arithmetic uses UTC dates, never local offsets or DST conversions.
export function parseDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return year >= 1 &&
    year <= 9999 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date
    : null;
}
export function dayString(date: Date): string {
  return `${String(date.getUTCFullYear()).padStart(4, "0")}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}
export function addDays(value: string, days: number): string {
  const date = parseDay(value)!;
  date.setUTCDate(date.getUTCDate() + days);
  return dayString(date);
}
export function moveMonth(value: string, months: number): string {
  const date = parseDay(value)!;
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const last = new Date(date);
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  date.setUTCDate(Math.min(day, last.getUTCDate()));
  return dayString(date);
}
export function calendarDays(month: string): string[] {
  const first = `${month.slice(0, 7)}-01`;
  const offset = (parseDay(first)!.getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) =>
    addDays(first, index - offset),
  );
}
export function inDateRange(
  value: string,
  min?: string,
  max?: string,
): boolean {
  return (
    !!parseDay(value) &&
    (!min || value >= min.slice(0, 10)) &&
    (!max || value <= max.slice(0, 10))
  );
}
export function clampDay(value: string, min?: string, max?: string): string {
  const low = min?.slice(0, 10) || "0001-01-01";
  const high = max?.slice(0, 10) || "9999-12-31";
  if (value.startsWith("-") || value.startsWith("0000-")) return low;
  if (value.split("-")[0].length > 4) return high;
  return value < low ? low : value > high ? high : value;
}
export function validTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
export function timeAllowed(
  value: string,
  min?: string,
  max?: string,
): boolean {
  if (!validTime(value)) return false;
  // Like a time field, a range crossing midnight wraps through 00:00.
  if (min && max && min > max) return value >= min || value <= max;
  return (!min || value >= min) && (!max || value <= max);
}
export function validPickerValue(
  value: string,
  type: PickerType,
  min?: string,
  max?: string,
): boolean {
  if (type === "date") return inDateRange(value, min, max);
  if (type === "time") return timeAllowed(value, min, max);
  const [day, time] = value.split("T");
  return (
    !!parseDay(day) &&
    validTime(time || "") &&
    (!min || value >= min) &&
    (!max || value <= max)
  );
}
export function displayValue(value: string, type: PickerType): string {
  if (!value) return "";
  if (type === "time") return validTime(value) ? value : "";
  const [day, time] = value.split("T");
  if (!parseDay(day)) return "";
  const [year, month, date] = day.split("-");
  return `${date}/${month}/${year}${type === "datetime-local" && time ? ` · ${time}` : ""}`;
}
