import {
  RefreshCw,
  CheckCircle2,
  Activity,
  Database,
  CircleAlert,
  Clock3,
  Info,
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
        eyebrow="QUẢN TRỊ"
        title="Trạng thái hệ thống"
        description="Kiểm tra khả năng kết nối và truy cập dữ liệu của không gian làm việc."
        action={
          <Button
            variant="secondary"
            busy={checking}
            onClick={() => void q.refetch()}
          >
            <RefreshCw size={16} />
            {checking ? "Đang kiểm tra" : "Kiểm tra lại"}
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
            <span className="system-eyebrow">KẾT QUẢ KIỂM TRA</span>
            <h2>
              {checking
                ? "Đang kiểm tra kết nối…"
                : healthy
                  ? "Kết nối hoạt động bình thường"
                  : "Kết nối cần được kiểm tra"}
            </h2>
            <p>
              {checking
                ? "Vui lòng chờ trong giây lát."
                : healthy
                  ? "Dịch vụ và dữ liệu đã phản hồi trong lần kiểm tra gần nhất."
                  : "Chưa thể xác nhận khả năng truy cập dữ liệu. Bạn có thể thử kiểm tra lại."}
            </p>
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
              title: "Dịch vụ ứng dụng",
              text: "Tiếp nhận và xử lý các thao tác của bạn.",
            },
            {
              key: "firestore",
              icon: Database,
              title: "Lưu trữ dữ liệu",
              text: "Truy cập dữ liệu nhân sự của doanh nghiệp.",
            },
          ].map(({ key, icon: Icon, title, text }) => {
            const ok =
              !q.error && q.data?.[key as "api" | "firestore"] === "ok";
            return (
              <div key={key}>
                <span className="system-service-icon">
                  <Icon size={20} />
                </span>
                <span className="system-service-name">
                  <strong>{title}</strong>
                  <small>{text}</small>
                </span>
                <span
                  className={`system-service-state ${checking ? "" : ok ? "ok" : "unknown"}`}
                >
                  {checking
                    ? "Đang kiểm tra"
                    : ok
                      ? "Đã kết nối"
                      : "Chưa xác nhận"}
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
                ? `Kiểm tra lúc ${timeText(q.data.checkedAt)} · ${dateText(q.data.checkedAt)}`
                : "Chưa có kết quả kiểm tra thành công"}
            </span>
          </div>
          {!q.error && q.data && (
            <span>
              Phản hồi:{" "}
              {(q.data.latencyMs / 1000).toLocaleString("vi-VN", {
                maximumFractionDigits: 2,
              })}{" "}
              giây
            </span>
          )}
        </footer>
      </section>
      <div className="system-context">
        <Info size={18} />
        <p>
          Kết quả phản ánh thời điểm kiểm tra, không phải trạng thái giám sát
          liên tục. Nếu gặp lỗi khi thao tác, hãy kiểm tra lại kết nối trước khi
          liên hệ người phụ trách kỹ thuật.
        </p>
      </div>
      {!q.error && q.data && (
        <details className="system-connection-details">
          <summary>Thông tin kết nối</summary>
          <dl>
            <div>
              <dt>Nơi lưu trữ</dt>
              <dd>
                {q.data.mode === "cloud"
                  ? "Trực tuyến · Firebase Firestore"
                  : q.data.mode === "emulator"
                    ? "Môi trường thử nghiệm cục bộ"
                    : "Chưa xác định"}
              </dd>
            </div>
            <div>
              <dt>Cách kiểm tra</dt>
              <dd>Thử truy cập một bản ghi để xác nhận kết nối dữ liệu.</dd>
            </div>
          </dl>
        </details>
      )}
    </>
  );
}
