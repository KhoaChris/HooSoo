import { t, useLocale } from "../../i18n";
import { CircleAlert, RotateCw } from "lucide-react";
import { ApiError } from "../../services/api-client";
import { Button } from "./button";
import { ErrorDetails } from "./error-details";

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
    <div className="error-box">
      <CircleAlert size={20} className="error-box-icon" aria-hidden="true" />
      <div className="error-box-content">
        <p role="alert">
          {t(error.message) || t("Không thể hoàn tất thao tác.")}
        </p>
        {error instanceof ApiError && error.requestId && (
          <ErrorDetails key={error.requestId} requestId={error.requestId} />
        )}
      </div>
      {retry && (
        <Button
          type="button"
          className="error-box-retry"
          variant="secondary"
          tone="danger"
          onClick={retry}
        >
          <RotateCw size={15} aria-hidden="true" />
          {t("Thử lại")}
        </Button>
      )}
    </div>
  );
}
