import { StableText } from "../../i18n/stable-text";
import { t, useLocale, intlLocale } from "../../i18n";
import {
  RefreshCw,
  CheckCircle2,
  Activity,
  Database,
  CircleAlert,
  Clock3,
  LoaderCircle,
} from "lucide-react";
import { useApi } from "../../hooks/data";
import { dateText, timeText } from "../../utils/date-time";
import { Heading, Button, ErrorBox } from "../../components/ui";
interface SystemStatus {
  status: string;
  api: string;
  firestore: string;
  mode: string;
  checkedAt: string;
  latencyMs: number;
}
export function SystemPage() {
  useLocale();
  const q = useApi<SystemStatus>("/system/status");
  const checking = q.isFetching,
    healthy =
      !q.error &&
      q.data?.status === "ok" &&
      q.data.api === "ok" &&
      q.data.firestore === "ok";
  const state = checking ? "checking" : healthy ? "healthy" : "attention";
  const StateIcon = checking
    ? LoaderCircle
    : healthy
      ? CheckCircle2
      : CircleAlert;
  return (
    <>
      <Heading
        eyebrow={t("QUẢN TRỊ")}
        title={t("Trạng thái hệ thống")}
        action={
          <Button
            variant="secondary"
            busy={checking}
            onClick={() => void q.refetch()}
          >
            <RefreshCw size={16} />
            {checking ? t("Đang kiểm tra") : t("Kiểm tra lại")}
          </Button>
        }
      />
      <section
        className={`system-overview ${state}`}
        aria-live="polite"
        aria-busy={checking}
      >
        <header className="system-status-heading">
          <span className="system-status-icon">
            <StateIcon size={30} className={checking ? "spin" : undefined} />
          </span>
          <div>
            <span className="system-eyebrow">{t("KẾT QUẢ KIỂM TRA")}</span>
            <h2>
              <StableText>
                {checking
                  ? t("Đang kiểm tra kết nối…")
                  : healthy
                    ? t("Kết nối hoạt động bình thường")
                    : t("Kết nối cần được kiểm tra")}
              </StableText>
            </h2>
          </div>
        </header>
        {!checking && q.error && (
          <div className="system-error">
            <ErrorBox error={q.error} />
          </div>
        )}
        <div className="system-services">
          {[
            {
              key: "api",
              icon: Activity,
              title: t("Dịch vụ ứng dụng"),
            },
            {
              key: "firestore",
              icon: Database,
              title: t("Lưu trữ dữ liệu"),
            },
          ].map(({ key, icon: Icon, title }) => {
            const ok =
              !q.error && q.data?.[key as "api" | "firestore"] === "ok";
            return (
              <div key={key}>
                <span className="system-service-icon">
                  <Icon size={20} />
                </span>
                <span className="system-service-name">
                  <strong>{title}</strong>
                </span>
                <span
                  className={`system-service-state ${checking ? "" : ok ? "ok" : "unknown"}`}
                >
                  {checking
                    ? t("Đang kiểm tra")
                    : ok
                      ? t("Đã kết nối")
                      : t("Chưa xác nhận")}
                </span>
              </div>
            );
          })}
        </div>
        <footer className="system-check-meta">
          <div>
            <Clock3 size={16} />
            <span>
              {!q.error && q.data?.checkedAt
                ? t("Kiểm tra lúc {0} · {1}", [
                    timeText(q.data.checkedAt),
                    dateText(q.data.checkedAt),
                  ])
                : t("Chưa có kết quả kiểm tra thành công")}
            </span>
          </div>
          {!q.error && q.data && (
            <span>
              {t("Phản hồi:")}{" "}
              {(q.data.latencyMs / 1000).toLocaleString(intlLocale(), {
                maximumFractionDigits: 2,
              })}{" "}
              {t("giây")}
            </span>
          )}
        </footer>
      </section>
      {!q.error && q.data && (
        <details className="system-connection-details">
          <summary>
            <StableText>{t("Thông tin kết nối")}</StableText>
          </summary>
          <dl>
            <div>
              <dt>
                <StableText>{t("Nơi lưu trữ")}</StableText>
              </dt>
              <dd>
                <StableText>
                  {q.data.mode === "cloud"
                    ? t("Trực tuyến · Firebase Firestore")
                    : q.data.mode === "emulator"
                      ? t("Môi trường thử nghiệm cục bộ")
                      : t("Chưa xác định")}
                </StableText>
              </dd>
            </div>
          </dl>
        </details>
      )}
    </>
  );
}
