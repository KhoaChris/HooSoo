import { Check, ChevronDown, Copy } from "lucide-react";
import { useState } from "react";
import { t, useLocale } from "../../i18n";

export function ErrorDetails({ requestId }: { requestId: string }) {
  useLocale();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

  return (
    <details className="error-details">
      <summary>
        {t("Chi tiết lỗi")}
        <ChevronDown size={14} aria-hidden="true" />
      </summary>
      <div className="error-reference">
        <div>
          <span className="error-reference-label">{t("Mã tra cứu:")}</span>
          <code>{requestId}</code>
        </div>
        <button
          type="button"
          className="icon-button error-copy"
          aria-label={t(
            copyState === "copied" ? "Đã sao chép mã" : "Sao chép mã tra cứu",
          )}
          title={t("Sao chép mã tra cứu")}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(requestId);
              setCopyState("copied");
            } catch {
              setCopyState("failed");
            }
          }}
        >
          {copyState === "copied" ? <Check size={16} /> : <Copy size={16} />}
        </button>
      </div>
      <span
        className={copyState === "failed" ? "error-copy-failed" : "sr-only"}
        role="status"
      >
        {copyState === "copied"
          ? t("Đã sao chép mã")
          : copyState === "failed"
            ? t("Chưa sao chép được. Bạn có thể chọn mã để sao chép.")
            : ""}
      </span>
    </details>
  );
}
