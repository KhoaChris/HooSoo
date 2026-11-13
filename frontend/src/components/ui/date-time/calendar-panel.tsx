import { useId, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { intlLocale, t, useLocale } from "../../../i18n";
import {
  addDays,
  calendarDays,
  clampDay,
  inDateRange,
  moveMonth,
  parseDay,
} from "./calendar-utils";

export function CalendarPanel({
  value,
  today,
  min,
  max,
  onSelect,
}: {
  value: string;
  today: string;
  min?: string;
  max?: string;
  onSelect: (day: string) => void;
}) {
  const locale = useLocale();
  const initial = clampDay(value || today, min, max);
  const [focusDay, setFocusDay] = useState(initial);
  const [month, setMonth] = useState(initial);
  const [view, setView] = useState<"days" | "months" | "years">("days");
  const [yearPage, setYearPage] = useState(parseDay(initial)!.getUTCFullYear());
  const root = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef(false);
  const id = useId();
  const year = parseDay(month)!.getUTCFullYear();
  const monthIndex = parseDay(month)!.getUTCMonth();
  const dateLabel = (day: string) =>
    new Intl.DateTimeFormat(intlLocale(), {
      dateStyle: "full",
      timeZone: "UTC",
    }).format(parseDay(day)!);
  const monthLabel = new Intl.DateTimeFormat(intlLocale(), {
    month: "long",
    timeZone: "UTC",
  }).format(parseDay(month)!);
  const focus = (day: string) => {
    const next = clampDay(day, min, max);
    setFocusDay(next);
    setMonth(next);
    setView("days");
    pendingFocus.current = true;
    root.current
      ?.querySelector<HTMLButtonElement>(`[data-day="${next}"]`)
      ?.focus();
  };
  useLayoutEffect(() => {
    if (!pendingFocus.current) return;
    root.current
      ?.querySelector<HTMLButtonElement>(`[data-day="${focusDay}"]`)
      ?.focus();
    pendingFocus.current = false;
  }, [focusDay, month, view]);
  const hasMonth = (day: string) => {
    const start = `${day.slice(0, 7)}-01`;
    if (!parseDay(start)) return false;
    const last = parseDay(start)!;
    last.setUTCMonth(last.getUTCMonth() + 1, 0);
    const end = `${start.slice(0, 7)}-${last.getUTCDate()}`;
    return (
      (!min || end >= min.slice(0, 10)) && (!max || start <= max.slice(0, 10))
    );
  };
  const canPage = (direction: number) =>
    view === "years"
      ? yearPage + direction * 12 >= 1 && yearPage + direction * 12 <= 9999
      : view === "months"
        ? hasYear(year + direction)
        : hasMonth(moveMonth(month, direction));
  const hasYear = (candidate: number) =>
    candidate >= 1 &&
    candidate <= 9999 &&
    (!min || candidate >= Number(min.slice(0, 4))) &&
    (!max || candidate <= Number(max.slice(0, 4)));
  const page = (direction: number) => {
    if (view === "years") setYearPage(yearPage + direction * 12);
    else {
      const next = clampDay(
        moveMonth(month, direction * (view === "months" ? 12 : 1)),
        min,
        max,
      );
      setMonth(next);
      setFocusDay(next);
    }
  };
  const days = calendarDays(month);
  const weekdays =
    locale === "vi"
      ? ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
      : ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  return (
    <div className="dtp-calendar" ref={root}>
      <div className="dtp-calendar-header">
        <button
          type="button"
          className="dtp-icon"
          aria-label={t("Lùi lịch")}
          disabled={!canPage(-1)}
          onClick={() => page(-1)}
        >
          <ChevronLeft size={17} />
        </button>
        <div className="dtp-period" aria-live="polite" id={`${id}-period`}>
          {view === "years" ? (
            <span>
              {Math.max(1, yearPage - 5)} – {Math.min(9999, yearPage + 6)}
            </span>
          ) : (
            <>
              <button
                type="button"
                aria-label={t("Chọn tháng")}
                onClick={() => setView(view === "months" ? "days" : "months")}
              >
                {monthLabel}
              </button>
              <button
                type="button"
                aria-label={t("Chọn năm")}
                onClick={() => {
                  setYearPage(year);
                  setView("years");
                }}
              >
                {year}
              </button>
            </>
          )}
        </div>
        <button
          type="button"
          className="dtp-icon"
          aria-label={t("Tiến lịch")}
          disabled={!canPage(1)}
          onClick={() => page(1)}
        >
          <ChevronRight size={17} />
        </button>
      </div>
      {view === "days" ? (
        <div className="dtp-grid" role="grid" aria-labelledby={`${id}-period`}>
          <div role="row" className="dtp-weekdays">
            {weekdays.map((label, index) => (
              <span
                role="columnheader"
                key={label}
                aria-label={new Intl.DateTimeFormat(intlLocale(), {
                  weekday: "long",
                  timeZone: "UTC",
                }).format(parseDay(addDays("2024-01-01", index))!)}
              >
                {label}
              </span>
            ))}
          </div>
          {Array.from({ length: 6 }, (_, week) => (
            <div role="row" className="dtp-week" key={week}>
              {days.slice(week * 7, week * 7 + 7).map((day) => {
                const enabled = inDateRange(day, min, max);
                return (
                  <div role="gridcell" key={day} aria-selected={day === value}>
                    <button
                      type="button"
                      data-day={day}
                      data-initial-focus={day === focusDay || undefined}
                      className={`dtp-day${day.slice(0, 7) !== month.slice(0, 7) ? " is-outside" : ""}${day === value ? " is-selected" : ""}`}
                      aria-current={day === today ? "date" : undefined}
                      aria-label={parseDay(day) ? dateLabel(day) : day}
                      disabled={!enabled}
                      tabIndex={day === focusDay && enabled ? 0 : -1}
                      onFocus={() => setFocusDay(day)}
                      onClick={() => onSelect(day)}
                      onKeyDown={(event) => {
                        let next: string | undefined;
                        const weekday = (parseDay(day)!.getUTCDay() + 6) % 7;
                        if (event.key === "ArrowLeft") next = addDays(day, -1);
                        if (event.key === "ArrowRight") next = addDays(day, 1);
                        if (event.key === "ArrowUp") next = addDays(day, -7);
                        if (event.key === "ArrowDown") next = addDays(day, 7);
                        if (event.key === "Home") next = addDays(day, -weekday);
                        if (event.key === "End")
                          next = addDays(day, 6 - weekday);
                        if (event.key === "PageUp")
                          next = moveMonth(day, event.shiftKey ? -12 : -1);
                        if (event.key === "PageDown")
                          next = moveMonth(day, event.shiftKey ? 12 : 1);
                        if (next) {
                          event.preventDefault();
                          focus(next);
                        }
                      }}
                    >
                      {Number(day.slice(-2))}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <div
          className="dtp-period-grid"
          aria-label={t(view === "months" ? "Chọn tháng" : "Chọn năm")}
        >
          {Array.from({ length: 12 }, (_, index) => {
            const candidate = view === "years" ? yearPage - 5 + index : year;
            const next = `${String(candidate).padStart(4, "0")}-${String(view === "months" ? index + 1 : monthIndex + 1).padStart(2, "0")}-01`;
            const enabled =
              view === "months" ? hasMonth(next) : hasYear(candidate);
            const label =
              view === "years"
                ? String(candidate)
                : new Intl.DateTimeFormat(intlLocale(), {
                    month: "short",
                    timeZone: "UTC",
                  }).format(parseDay(next)!);
            return (
              <button
                type="button"
                key={index}
                disabled={!enabled}
                aria-pressed={
                  view === "years" ? candidate === year : index === monthIndex
                }
                onClick={() => {
                  if (view === "years") {
                    const nextDay = clampDay(next, min, max);
                    setMonth(nextDay);
                    setFocusDay(nextDay);
                    setView("months");
                  } else focus(next);
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
