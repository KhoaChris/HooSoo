import {
  useId,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithRef,
} from "react";
import * as Popover from "@radix-ui/react-popover";
import { CalendarDays, Clock3, X } from "lucide-react";
import { t, useLocale } from "../../i18n";
import { StableText } from "../../i18n/stable-text";
import { today } from "../../utils/date-time";
import { CalendarPanel } from "./date-time/calendar-panel";
import { TimePanel } from "./date-time/time-panel";
import {
  clampDay,
  displayValue,
  inDateRange,
  parseDay,
  validPickerValue,
  validTime,
  type PickerType,
} from "./date-time/calendar-utils";

type Props = Omit<
  ComponentPropsWithRef<"button">,
  "type" | "value" | "onChange"
> & {
  type?: PickerType;
  value: string;
  onValueChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
};

/** Controlled date/time strings stay identical to API and form schema values. */
export function DateTimePicker({
  type = "date",
  value,
  onValueChange,
  min,
  max,
  placeholder,
  className = "",
  ref,
  name,
  ...props
}: Props) {
  useLocale();
  const trigger = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const keepAnchorVisible = () => {
      const box = trigger.current?.getBoundingClientRect();
      // Resizing can move a filter off-screen. Dismiss its uncommitted popup
      // instead of leaving a focus trap attached to an invisible field.
      if (
        box &&
        (box.top >= innerHeight ||
          box.bottom <= 0 ||
          box.left >= innerWidth ||
          box.right <= 0)
      )
        setOpen(false);
    };
    window.addEventListener("resize", keepAnchorVisible);
    return () => window.removeEventListener("resize", keepAnchorVisible);
  }, [open]);
  const label = t(
    type === "date"
      ? "Chọn ngày"
      : type === "time"
        ? "Chọn giờ"
        : "Chọn ngày và giờ",
  );
  const shown = displayValue(value, type);
  return (
    <Popover.Root
      modal
      open={open}
      onOpenChange={(next) => {
        if (next) setContainer(trigger.current?.closest("dialog") ?? null);
        setOpen(next);
      }}
    >
      <Popover.Trigger asChild>
        <button
          {...props}
          type="button"
          className={`date-time-trigger ${className}`.trim()}
          data-placeholder={!shown || undefined}
          aria-label={props["aria-label"] || (props.id ? undefined : label)}
          ref={(node) => {
            trigger.current = node;
            if (typeof ref === "function") ref(node);
            else if (ref) ref.current = node;
          }}
        >
          <span>
            {shown ||
              placeholder ||
              (type === "date"
                ? "dd/mm/yyyy"
                : type === "time"
                  ? "--:--"
                  : "dd/mm/yyyy · --:--")}
          </span>
          {type === "time" ? (
            <Clock3 size={17} aria-hidden="true" />
          ) : (
            <CalendarDays size={17} aria-hidden="true" />
          )}
        </button>
      </Popover.Trigger>
      {name && (
        <input
          type="hidden"
          name={name}
          value={value}
          disabled={props.disabled}
        />
      )}
      <Popover.Portal container={container}>
        <Popover.Content
          className="dtp-popover"
          data-date-time-popover
          align="start"
          sideOffset={7}
          collisionPadding={12}
          aria-label={label}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (container ?? document.body)
              .querySelector<HTMLElement>(
                '[data-date-time-popover] [data-initial-focus="true"]',
              )
              ?.focus();
          }}
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            setOpen(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") event.stopPropagation();
          }}
        >
          <PickerPanel
            type={type}
            value={value}
            min={min}
            max={max}
            label={label}
            onCancel={() => setOpen(false)}
            onCommit={(next) => {
              onValueChange(next);
              setOpen(false);
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function PickerPanel({
  type,
  value,
  min,
  max,
  label,
  onCommit,
  onCancel,
}: {
  type: PickerType;
  value: string;
  min?: string;
  max?: string;
  label: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const now = today();
  const [date, setDate] = useState(() =>
    clampDay(
      parseDay(value.slice(0, 10)) ? value.slice(0, 10) : now,
      type === "time" ? undefined : min,
      type === "time" ? undefined : max,
    ),
  );
  const [time, setTime] = useState(() => {
    const supplied = type === "time" ? value : value.split("T")[1];
    return validTime(supplied || "") ? supplied : "08:00";
  });
  const [panel, setPanel] = useState<"date" | "time">(
    type === "time" ? "time" : "date",
  );
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef(false);
  useLayoutEffect(() => {
    if (!pendingFocus.current) return;
    root.current
      ?.querySelector<HTMLElement>('[data-initial-focus="true"]')
      ?.focus();
    pendingFocus.current = false;
  }, [panel]);
  const changePanel = (next: "date" | "time", focus = false) => {
    pendingFocus.current = focus;
    setPanel(next);
  };
  const composed = type === "time" ? time : `${date}T${time}`;
  const valid = validPickerValue(composed, type, min, max);
  return (
    <div ref={root}>
      <header className="dtp-heading">
        <strong>{label}</strong>
        <button
          type="button"
          className="dtp-icon"
          aria-label={t("Đóng bộ chọn")}
          onClick={onCancel}
        >
          <X size={16} />
        </button>
      </header>
      {type === "datetime-local" && (
        <div className="dtp-tabs" role="tablist" aria-label={label}>
          {(["date", "time"] as const).map((tab, index) => (
            <button
              key={tab}
              type="button"
              role="tab"
              id={`${id}-${tab}-tab`}
              aria-controls={`${id}-${tab}-panel`}
              aria-selected={panel === tab}
              tabIndex={panel === tab ? 0 : -1}
              onClick={() => changePanel(tab)}
              onKeyDown={(event) => {
                if (
                  ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
                ) {
                  event.preventDefault();
                  const next =
                    event.key === "Home"
                      ? "date"
                      : event.key === "End"
                        ? "time"
                        : index === 0
                          ? "time"
                          : "date";
                  changePanel(next);
                  root.current
                    ?.querySelector<HTMLButtonElement>(
                      `[id="${id}-${next}-tab"]`,
                    )
                    ?.focus();
                }
              }}
            >
              {tab === "date" ? (
                <CalendarDays size={15} />
              ) : (
                <Clock3 size={15} />
              )}
              <StableText>{t(tab === "date" ? "Ngày" : "Giờ")}</StableText>
            </button>
          ))}
        </div>
      )}
      <div
        className="dtp-panel"
        role={type === "datetime-local" ? "tabpanel" : undefined}
        id={`${id}-${panel}-panel`}
        aria-labelledby={
          type === "datetime-local" ? `${id}-${panel}-tab` : undefined
        }
      >
        {panel === "date" ? (
          <CalendarPanel
            value={type === "date" ? value : date}
            today={now}
            min={min}
            max={max}
            onSelect={(day) => {
              if (type === "date") onCommit(day);
              else {
                setDate(day);
                changePanel("time", true);
              }
            }}
          />
        ) : (
          <TimePanel
            value={time}
            min={
              type === "time"
                ? min
                : min?.startsWith(date)
                  ? min.slice(11)
                  : undefined
            }
            max={
              type === "time"
                ? max
                : max?.startsWith(date)
                  ? max.slice(11)
                  : undefined
            }
            onChange={setTime}
          />
        )}
      </div>
      {type === "datetime-local" && (
        <output className="dtp-preview" aria-live="polite">
          {displayValue(composed, type)}
        </output>
      )}
      <footer className="dtp-footer">
        <button
          type="button"
          className="dtp-text-button"
          disabled={!value}
          onClick={() => onCommit("")}
        >
          <StableText>{t("Xóa lựa chọn")}</StableText>
        </button>
        {type === "date" ? (
          <button
            type="button"
            className="dtp-text-button dtp-today"
            disabled={!inDateRange(now, min, max)}
            onClick={() => onCommit(now)}
          >
            <StableText>{t("Hôm nay")}</StableText>
          </button>
        ) : (
          <button
            type="button"
            className="dtp-apply"
            disabled={!valid}
            onClick={() => onCommit(composed)}
          >
            <StableText>{t("Áp dụng")}</StableText>
          </button>
        )}
      </footer>
    </div>
  );
}
