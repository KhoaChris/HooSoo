import { Link } from "react-router-dom";

export function ErrorPage({ forbidden = false }: { forbidden?: boolean }) {
  return (
    <section className="empty error-page">
      <span className="eyebrow">{forbidden ? "403" : "404"}</span>
      <h1>
        {forbidden ? "Bạn chưa có quyền truy cập" : "Không tìm thấy trang"}
      </h1>
      <p>
        {forbidden
          ? "Liên hệ quản trị viên nếu bạn cần quyền thực hiện công việc này."
          : "Đường dẫn có thể đã thay đổi hoặc không tồn tại."}
      </p>
      <Link className="button primary" to="/dashboard">
        Về tổng quan
      </Link>
    </section>
  );
}
