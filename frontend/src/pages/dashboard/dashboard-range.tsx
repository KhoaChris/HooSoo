import { t, useLocale } from "../../i18n";
import { useRef, useState } from "react";
import { querySchema } from "@hoosoo/shared";
import { CalendarDays } from "lucide-react";
import { Button, DateTimePicker, Select } from "../../components/ui";
import { dateText, today } from "../../utils/date-time";
import { monthRange, type DashboardRange } from "./dashboard-data";

export function DashboardRangeFilter({
  range,
  onChange,
}: {
  range: DashboardRange;
  onChange: (range: DashboardRange) => void;
}) {
  useLocale();
  const thisMonth = monthRange(today());
  const lastMonth = monthRange(today(), -1);
  const matches = (other: DashboardRange) =>
    range.start === other.start && range.end === other.end;
  const [custom, setCustom] = useState(false);
  const [draft, setDraft] = useState(range);
  const [error, setError] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => {
    setCustom(false);
    setError("");
    trigger.current?.focus();
  };
  const preset = custom
    ? "custom"
    : matches(thisMonth)
      ? "month"
      : matches(lastMonth)
        ? "last"
        : "custom";
  return (
    <div className="dashboard-range">
      <div className="dashboard-range-summary">
        <span>
          <CalendarDays size={16} aria-hidden="true" /> {t("Kỳ thống kê")}
        </span>
        <strong>
          {dateText(range.start)} – {dateText(range.end)}
        </strong>
        <Select
          ref={trigger}
          aria-label={t("Chọn kỳ thống kê")}
          value={preset}
          options={[
            { value: "month", label: t("Tháng này") },
            { value: "last", label: t("Tháng trước") },
            { value: "custom", label: t("Tùy chọn ngày") },
          ]}
          onValueChange={(value) => {
            setError("");
            if (value === "custom") {
              setDraft(range);
              setCustom(true);
            } else {
              setCustom(false);
              onChange(value === "month" ? thisMonth : lastMonth);
            }
          }}
        />
        {!custom && preset === "custom" && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setDraft(range);
              setCustom(true);
            }}
          >
            {t("Sửa ngày")}
          </Button>
        )}
      </div>
      {custom && (
        <form
          className="dashboard-range-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!draft.start || !draft.end) {
              setError(t("Chọn đủ ngày bắt đầu và ngày kết thúc."));
              return;
            }
            const result = querySchema.safeParse({
              startDate: draft.start,
              endDate: draft.end,
            });
            if (!result.success) {
              setError(result.error.issues[0].message);
              return;
            }
            onChange(draft);
            close();
          }}
        >
          <label htmlFor="dashboard-start">
            {t("Từ ngày")}
            <DateTimePicker
              id="dashboard-start"
              type="date"
              value={draft.start}
              aria-invalid={!!error}
              aria-describedby={error ? "dashboard-range-error" : undefined}
              onValueChange={(value) => {
                setDraft({ ...draft, start: value });
                setError("");
              }}
            />
          </label>
          <label htmlFor="dashboard-end">
            {t("Đến ngày")}
            <DateTimePicker
              id="dashboard-end"
              type="date"
              value={draft.end}
              aria-invalid={!!error}
              aria-describedby={error ? "dashboard-range-error" : undefined}
              onValueChange={(value) => {
                setDraft({ ...draft, end: value });
                setError("");
              }}
            />
          </label>
          <div className="dashboard-range-actions">
            <Button type="button" variant="secondary" onClick={close}>
              {t("Đóng")}
            </Button>
            <Button type="submit">{t("Áp dụng")}</Button>
          </div>
          {error && (
            <p id="dashboard-range-error" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
