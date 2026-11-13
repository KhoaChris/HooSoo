import { t, useLocale } from "../../i18n";
import { DialogLink } from "../../components/navigation/dialog-link";
import { Link } from "react-router-dom";
import { ArrowRight, Clock, Plus } from "lucide-react";
import type { AttendanceView, BalanceView } from "@hoosoo/shared";
import { timeText, today } from "../../utils/date-time";

export function DashboardPersonal({
  attendance,
  balance,
}: {
  attendance?: AttendanceView;
  balance?: BalanceView;
}) {
  useLocale();
  const completed = !!attendance?.checkOut;
  return (
    <aside
      className="dashboard-personal"
      aria-label={t("Thông tin cá nhân hôm nay")}
    >
      <section className="dashboard-day">
        <div className="dashboard-section-heading">
          <h2>{t("Hôm nay của bạn")}</h2>
          <Clock size={18} aria-hidden="true" />
        </div>
        <p className="dashboard-day-status">
          <i data-recorded={!!attendance} aria-hidden="true" />
          {t(
            completed
              ? "Đã hoàn tất chấm công"
              : attendance
                ? "Đang trong ca"
                : "Chưa có giờ vào",
          )}
        </p>
        <dl className="dashboard-time-pair">
          <div>
            <dt>{t("Giờ vào")}</dt>
            <dd>{timeText(attendance?.checkIn)}</dd>
          </div>
          <div>
            <dt>{t("Giờ ra")}</dt>
            <dd>{timeText(attendance?.checkOut)}</dd>
          </div>
        </dl>
        <Link
          className="button secondary dashboard-attendance-link"
          to="/attendance/my"
        >
          {t(
            completed
              ? "Xem chấm công"
              : attendance
                ? "Chấm công ra"
                : "Chấm công vào",
          )}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>
      <section className="dashboard-balance">
        <div className="dashboard-section-heading">
          <h2>{t("Quỹ phép của bạn")}</h2>
          <span>{balance?.year ?? today().slice(0, 4)}</span>
        </div>
        {balance ? (
          <>
            <p className="dashboard-balance-value">
              <strong>{balance.available}</strong>
              <span>{t("ngày còn lại")}</span>
            </p>
            <div
              className="dashboard-meter"
              role="meter"
              aria-label={t("Phép đã sử dụng")}
              aria-valuemin={0}
              aria-valuemax={Math.max(balance.allowance, balance.used, 1)}
              aria-valuenow={Math.max(0, balance.used)}
            >
              <span
                style={{
                  width: `${Math.min(100, Math.max(0, (balance.used / Math.max(balance.allowance, 1)) * 100))}%`,
                }}
              />
            </div>
            <dl className="dashboard-balance-details">
              <div>
                <dt>{t("Đã dùng")}</dt>
                <dd>{balance.used}</dd>
              </div>
              <div>
                <dt>{t("Được cấp")}</dt>
                <dd>{balance.allowance}</dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="dashboard-caption">
            {t("Chưa có thông tin quỹ phép.")}
          </p>
        )}
        <DialogLink className="dashboard-text-link" to="/leave/new">
          <Plus size={16} aria-hidden="true" />
          {t("Tạo đơn nghỉ phép")}
        </DialogLink>
      </section>
    </aside>
  );
}
