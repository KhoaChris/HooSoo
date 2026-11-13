import { t, useLocale } from "../../i18n";
import { Link } from "react-router-dom";

export function ErrorPage({ forbidden = false }: { forbidden?: boolean }) {
  useLocale();
  return (
    <section className="empty error-page">
      <span className="eyebrow">{forbidden ? "403" : "404"}</span>
      <h1>
        {forbidden
          ? t("Bạn chưa có quyền truy cập")
          : t("Không tìm thấy trang")}
      </h1>
      <p>
        {forbidden
          ? t(
              "Liên hệ quản trị viên nếu bạn cần quyền thực hiện công việc này.",
            )
          : t("Đường dẫn có thể đã thay đổi hoặc không tồn tại.")}
      </p>
      <Link className="button primary" to="/dashboard">
        {t("Về tổng quan")}
      </Link>
    </section>
  );
}
