import { Input } from "./input";
export function DateFilters({
  start,
  end,
  onChange,
}: {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
}) {
  return (
    <>
      <label className="filter-label">
        Từ ngày
        <Input
          type="date"
          value={start}
          onChange={(e) => onChange(e.target.value, end)}
        />
      </label>
      <label className="filter-label">
        Đến ngày
        <Input
          type="date"
          value={end}
          onChange={(e) => onChange(start, e.target.value)}
        />
      </label>
    </>
  );
}
