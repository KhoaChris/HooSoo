import { t, useLocale } from "../../i18n";
import { DateTimePicker } from "./date-time-picker";
export function DateFilters({
  start,
  end,
  onChange,
}: {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
}) {
  useLocale();
  return (
    <>
      <label className="filter-label date-filter-label">
        <span>{t("Từ ngày")}</span>
        <DateTimePicker
          aria-label={t("Từ ngày")}
          type="date"
          value={start}
          onValueChange={(value) => onChange(value, end)}
        />
      </label>
      <label className="filter-label date-filter-label">
        <span>{t("Đến ngày")}</span>
        <DateTimePicker
          aria-label={t("Đến ngày")}
          type="date"
          value={end}
          onValueChange={(value) => onChange(start, value)}
        />
      </label>
    </>
  );
}
