import { DialogLink } from "../../components/navigation/dialog-link";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Clock } from "lucide-react";
import type { AttendanceView, BalanceView } from "@hoosoo/shared";
import { dateText, timeText, today } from "../../utils/date-time";

export function DashboardPersonal({
  attendance,
  balance,
}: {
  attendance?: AttendanceView;
  balance?: BalanceView;
}) {
  const completed = !!attendance?.checkOut;
  return (
    <aside
      className="dashboard-personal"
      aria-label="Thông tin cá nhân hôm nay"
    >
      <section className="dashboard-day" aria-labelledby="dashboard-day-title">
        <div className="dashboard-section-heading">
          <h2 id="dashboard-day-title">Hôm nay của bạn</h2>
          <Clock size={17} aria-hidden="true" />
        </div>
        <p className="dashboard-caption">{dateText(today())}</p>
        <div
          className={
            "dashboard-day-status" + (attendance ? " is-recorded" : "")
          }
        >
          <span aria-hidden="true">
            {completed ? <Check size={17} /> : <Clock size={17} />}
          </span>
          <div>
            <strong>
              {completed
                ? "Đã hoàn tất chấm công"
                : attendance
                  ? "Đã ghi nhận giờ vào"
                  : "Chưa có giờ vào"}
            </strong>
            <p>
              {completed
                ? "Giờ vào và giờ ra đã được ghi nhận."
                : attendance
                  ? "Nhớ chấm công khi kết thúc làm việc."
                  : "Mở chấm công để bắt đầu ngày làm việc."}
            </p>
          </div>
        </div>
        <dl className="dashboard-time-pair">
          <div>
            <dt>Giờ vào</dt>
            <dd>{timeText(attendance?.checkIn)}</dd>
          </div>
          <div>
            <dt>Giờ ra</dt>
            <dd>{timeText(attendance?.checkOut)}</dd>
          </div>
        </dl>
        <Link
          className="button secondary dashboard-attendance-link"
          to="/attendance/my"
        >
          {completed
            ? "Xem chấm công"
            : attendance
              ? "Chấm công ra"
              : "Chấm công vào"}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>
      <section
        className="dashboard-balance"
        aria-labelledby="dashboard-balance-title"
      >
        <div className="dashboard-section-heading">
          <h2 id="dashboard-balance-title">Quỹ phép của bạn</h2>
          <span>{balance?.year ?? today().slice(0, 4)}</span>
        </div>
        {balance ? (
          <>
            <p className="dashboard-balance-value">
              <strong>{balance.available}</strong>
              <span>ngày còn lại</span>
            </p>
            <div
              className="dashboard-balance-track"
              role="meter"
              aria-label="Phép đã sử dụng"
              aria-valuemin={0}
              aria-valuemax={Math.max(balance.allowance, balance.used, 1)}
              aria-valuenow={Math.max(0, balance.used)}
              aria-valuetext={`${balance.used} ngày đã dùng trên ${balance.allowance} ngày được cấp`}
            >
              <span
                style={{
                  width: `${Math.min(100, Math.max(0, (balance.used / Math.max(balance.allowance, 1)) * 100))}%`,
                }}
              />
            </div>
            <div className="dashboard-balance-details">
              <span>
                Đã dùng <strong>{balance.used} ngày</strong>
              </span>
              <span>
                Được cấp <strong>{balance.allowance} ngày</strong>
              </span>
            </div>
            <p className="dashboard-caption">
              Đơn chờ duyệt chưa trừ vào phép còn lại.
            </p>
          </>
        ) : (
          <p className="dashboard-caption dashboard-balance-missing">
            Chưa có thông tin quỹ phép.
          </p>
        )}
        <Link className="dashboard-text-link" to="/leave/my">
          Xem nghỉ phép của tôi <ArrowRight size={15} aria-hidden="true" />
        </Link>
        <DialogLink
          className="button secondary dashboard-attendance-link"
          to="/leave/new"
        >
          Tạo đơn nghỉ phép <ArrowRight size={16} aria-hidden="true" />
        </DialogLink>
      </section>
    </aside>
  );
}
