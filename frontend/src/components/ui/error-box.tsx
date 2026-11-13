import { t, useLocale } from "../../i18n";
import { TriangleAlert } from "lucide-react";
import { ApiError } from "../../services/api-client";
import { Button } from "./button";

export function ErrorBox({
  error,
  retry,
}: {
  error: Error | null;
  retry?: () => void;
}) {
  useLocale();
  if (!error) return null;
  return (
    <div className="error-box" role="alert">
      <TriangleAlert size={20} />
      <div>
        <strong>{t(error.message)}</strong>
        {error instanceof ApiError && error.requestId && (
          <small>
            {t("Mã tra cứu:")} {error.requestId}
          </small>
        )}
        {retry && (
          <Button variant="secondary" tone="danger" onClick={retry}>
            {t("Thử lại")}
          </Button>
        )}
      </div>
    </div>
  );
}
