import { t, useLocale } from "../../i18n";
import { LoaderCircle } from "lucide-react";

export function Loading() {
  useLocale();
  return (
    <div className="loading" aria-live="polite">
      <LoaderCircle className="spin" size={22} /> {" "}{t("Đang tải dữ liệu…")}
    </div>
  );
}
