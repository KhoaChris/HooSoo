import { useLayoutEffect, useId, useRef } from "react";
import { Check } from "lucide-react";
import { t, useLocale } from "../../../i18n";
import { pad, timeAllowed } from "./calendar-utils";

export function TimePanel({
  value,
  min,
  max,
  onChange,
}: {
  value: string;
  min?: string;
  max?: string;
  onChange: (time: string) => void;
}) {
  useLocale();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [hour, minute] = value.split(":").map(Number);
  useLayoutEffect(() => {
    const keepSelectionVisible = () =>
      root.current
        ?.querySelectorAll<HTMLElement>('[aria-selected="true"]')
        .forEach((option) => {
          const list = option.parentElement!;
          list.scrollTop =
            option.offsetTop - list.clientHeight / 2 + option.clientHeight / 2;
        });
    keepSelectionVisible();
    const resize = new ResizeObserver(keepSelectionVisible);
    root.current
      ?.querySelectorAll<HTMLElement>('[role="listbox"]')
      .forEach((list) => resize.observe(list));
    return () => resize.disconnect();
  }, [hour, minute]);
  const enabled = (column: number, index: number) =>
    column === 0
      ? Array.from({ length: 60 }, (_, m) => `${pad(index)}:${pad(m)}`).some(
          (time) => timeAllowed(time, min, max),
        )
      : timeAllowed(`${pad(hour)}:${pad(index)}`, min, max);
  const choose = (column: number, index: number) => {
    const nextHour = column === 0 ? index : hour;
    let nextMinute = column === 1 ? index : minute;
    if (!timeAllowed(`${pad(nextHour)}:${pad(nextMinute)}`, min, max)) {
      nextMinute =
        Array.from({ length: 60 }, (_, m) => m).find((m) =>
          timeAllowed(`${pad(nextHour)}:${pad(m)}`, min, max),
        ) ?? 0;
    }
    onChange(`${pad(nextHour)}:${pad(nextMinute)}`);
  };
  return (
    <div className="dtp-time" ref={root}>
      <div className="dtp-time-heading">
        <span>{t("Giờ")}</span>
        <span>{t("Phút")}</span>
      </div>
      <div className="dtp-time-columns">
        {[24, 60].map((count, column) => {
          const selected = column === 0 ? hour : minute;
          return (
            <div
              key={column}
              role="listbox"
              tabIndex={0}
              aria-label={t(column === 0 ? "Giờ" : "Phút")}
              data-initial-focus={column === 0 || undefined}
              aria-activedescendant={`${id}-${column}-${selected}`}
              className="dtp-time-list"
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                  event.preventDefault();
                  root.current
                    ?.querySelectorAll<HTMLElement>('[role="listbox"]')
                    .item(column === 0 ? 1 : 0)
                    ?.focus();
                  return;
                }
                const options = Array.from(
                  { length: count },
                  (_, i) => i,
                ).filter((i) => enabled(column, i));
                let index = options.indexOf(selected);
                if (event.key === "ArrowDown") index++;
                else if (event.key === "ArrowUp") index--;
                else if (event.key === "PageDown") index += 5;
                else if (event.key === "PageUp") index -= 5;
                else if (event.key === "Home") index = 0;
                else if (event.key === "End") index = options.length - 1;
                else return;
                event.preventDefault();
                if (options.length)
                  choose(
                    column,
                    options[Math.max(0, Math.min(options.length - 1, index))],
                  );
              }}
            >
              {Array.from({ length: count }, (_, index) => (
                <button
                  key={index}
                  type="button"
                  role="option"
                  tabIndex={-1}
                  id={`${id}-${column}-${index}`}
                  aria-selected={index === selected}
                  disabled={!enabled(column, index)}
                  onClick={(event) => {
                    event.currentTarget.parentElement?.focus();
                    choose(column, index);
                  }}
                >
                  {pad(index)}
                  {index === selected && <Check size={14} aria-hidden="true" />}
                </button>
              ))}
            </div>
          );
        })}
      </div>
      <p className="dtp-time-note">{t("Định dạng 24 giờ")}</p>
    </div>
  );
}
