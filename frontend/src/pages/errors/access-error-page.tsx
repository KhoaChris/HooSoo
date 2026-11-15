import { CircleAlert, LogOut, RotateCw, ShieldX, WifiOff } from "lucide-react";
import { t, useLocale } from "../../i18n";
import { ApiError } from "../../services/api-client";
import { Button } from "../../components/ui/button";
import { ErrorDetails } from "../../components/ui/error-details";

export function AccessErrorPage({
  error,
  retry,
  logout,
}: {
  error: Error;
  retry: () => void;
  logout: () => Promise<void>;
}) {
  useLocale();
  const status = error instanceof ApiError ? error.status : undefined;
  const restricted = status === 401 || status === 403;
  const Icon = restricted ? ShieldX : status === 0 ? WifiOff : CircleAlert;
  const title =
    status === 403
      ? t("Chưa có quyền truy cập")
      : status === 401
        ? t("Phiên đăng nhập không hợp lệ")
        : status === 0
          ? t("Không thể kết nối")
          : t("Chưa thể mở không gian làm việc");

  return (
    <main className="access-error-page">
      <section
        className="access-error-panel"
        aria-labelledby="access-error-title"
      >
        <div className="access-error-brand">
          <span className="brand-mark" aria-hidden="true">
            h.
          </span>
          <span>HooSoo</span>
        </div>
        <div className="access-error-message" role="alert">
          <div className="access-error-icon">
            <Icon size={28} strokeWidth={1.7} aria-hidden="true" />
          </div>
          <div>
            <h1 id="access-error-title">{title}</h1>
            <p>{t(error.message) || t("Không thể hoàn tất thao tác.")}</p>
          </div>
        </div>
        <div className="access-error-actions">
          <Button type="button" onClick={retry}>
            <RotateCw size={16} aria-hidden="true" />
            {t("Thử lại")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void logout()}
          >
            <LogOut size={16} aria-hidden="true" />
            {t("Đăng xuất")}
          </Button>
        </div>
        {error instanceof ApiError && error.requestId && (
          <ErrorDetails key={error.requestId} requestId={error.requestId} />
        )}
      </section>
    </main>
  );
}
