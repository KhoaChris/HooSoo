import { describe, expect, it } from "vitest";
import {
  addDays,
  calendarDays,
  clampDay,
  displayValue,
  inDateRange,
  moveMonth,
  parseDay,
  timeAllowed,
  validPickerValue,
} from "../src/components/ui/date-time/calendar-utils";

describe("custom date/time picker values", () => {
  it("rejects invalid dates and handles leap years and month-end navigation", () => {
    expect(parseDay("2026-02-29")).toBeNull();
    expect(parseDay("2028-02-29")).not.toBeNull();
    expect(parseDay("2026-13-01")).toBeNull();
    expect(parseDay("0000-01-01")).toBeNull();
    expect(moveMonth("2026-01-31", 1)).toBe("2026-02-28");
    expect(moveMonth("2028-01-31", 1)).toBe("2028-02-29");
    expect(moveMonth("2028-02-29", -12)).toBe("2027-02-28");
    expect(moveMonth("2026-01-01", -1)).toBe("2025-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
  });
  it("always provides six full Monday-first weeks, including adjacent months", () => {
    const days = calendarDays("2026-11-13");
    expect(days).toHaveLength(42);
    expect(days[0]).toBe("2026-10-26");
    expect(days[41]).toBe("2026-12-06");
    expect(new Set(days).size).toBe(42);
    expect(calendarDays("2027-02-01")[0]).toBe("2027-02-01");
  });
  it("enforces inclusive date and time boundaries, including datetime boundaries", () => {
    expect(inDateRange("2026-11-13", "2026-11-13", "2026-11-13")).toBe(true);
    expect(inDateRange("2026-11-12", "2026-11-13")).toBe(false);
    expect(clampDay("2026-11-30", undefined, "2026-11-20T17:00")).toBe(
      "2026-11-20",
    );
    expect(timeAllowed("08:29", "08:30", "17:00")).toBe(false);
    expect(timeAllowed("17:00", "08:30", "17:00")).toBe(true);
    expect(timeAllowed("00:15", "22:00", "06:00")).toBe(true);
    expect(timeAllowed("12:00", "22:00", "06:00")).toBe(false);
    expect(
      validPickerValue(
        "2026-11-13T08:29",
        "datetime-local",
        "2026-11-13T08:30",
      ),
    ).toBe(false);
    expect(
      validPickerValue(
        "2026-11-14T08:29",
        "datetime-local",
        "2026-11-13T08:30",
      ),
    ).toBe(true);
    expect(validPickerValue("2026-11-13T24:00", "datetime-local")).toBe(false);
    expect(validPickerValue("", "date")).toBe(false);
  });
  it("formats display without changing canonical API values or time zones", () => {
    expect(displayValue("2026-11-13", "date")).toBe("13/11/2026");
    expect(displayValue("2026-11-13T08:07", "datetime-local")).toBe(
      "13/11/2026 · 08:07",
    );
    expect(displayValue("08:07", "time")).toBe("08:07");
    expect(displayValue("", "date")).toBe("");
    expect(displayValue("invalid", "date")).toBe("");
  });
});
