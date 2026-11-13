import { useLocale } from "../../i18n";
import { StableText } from "../../i18n/stable-text";
export function Metric({
  label,
  value,
  note,
  emptyLabel,
  accent = false,
}: {
  label: string;
  value: string | number | null;
  emptyLabel?: string;
  note?: string;
  accent?: boolean;
}) {
  useLocale();
  return (
    <div className={"metric " + (accent ? "accent" : "")}>
      <span>
        <StableText>{label}</StableText>
      </span>
      <strong>{value ?? "—"}</strong>
      {value === null && emptyLabel && (
        <span className="metric-empty">
          <StableText>{emptyLabel}</StableText>
        </span>
      )}
      {note && (
        <small>
          <StableText>{note}</StableText>
        </small>
      )}
    </div>
  );
}
