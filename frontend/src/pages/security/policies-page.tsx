import { Link } from "react-router-dom";
import {
  ShieldCheck,
  Database,
  UserRoundCheck,
  Copyright,
  ArrowLeft,
} from "lucide-react";
import { HeaderTools } from "../../components/header/header-tools";
import { useAuth } from "../../app/auth";
import { t, useLocale } from "../../i18n";
const sections = [
  {
    id: "data",
    icon: Database,
    title: "Dữ liệu được xử lý",
    items: [
      "HooSoo xử lý hồ sơ nhân viên, chấm công, nghỉ phép, tuyển dụng, đánh giá, lương, tài sản, đào tạo và trao đổi nội bộ để phục vụ quản trị nhân lực.",
      "Đăng nhập do Firebase Authentication xử lý. Dữ liệu nghiệp vụ được lưu trong Firestore và truy cập qua API có xác thực.",
      "Bản dự án phục vụ học tập và trình diễn dùng dữ liệu giả lập. Không đưa hồ sơ cá nhân thật vào môi trường trình diễn.",
    ],
  },
  {
    id: "access",
    icon: UserRoundCheck,
    title: "Quyền truy cập & điều chỉnh",
    items: [
      "Nhân viên xem dữ liệu cá nhân được công bố; quản lý làm việc trong phạm vi được giao. Nhân sự không được sửa hồ sơ cấp ngang hàng hoặc cấp trên.",
      "Lương cá nhân và hồ sơ tuyển dụng chỉ hiển thị cho người có quyền. Vai trò quản trị không tự cấp quyền đọc nội dung trò chuyện riêng.",
      "Bạn có thể cập nhật thông tin liên hệ và gửi phiếu đề nghị điều chỉnh. Các thay đổi nghiệp vụ có nhật ký để tra cứu.",
    ],
  },
  {
    id: "security",
    icon: ShieldCheck,
    title: "Sử dụng tài khoản an toàn",
    items: [
      "Không chia sẻ mật khẩu hoặc mã truy cập API. Đăng xuất sau khi sử dụng máy dùng chung.",
      "Không tải tệp hoặc liên kết không rõ nguồn gốc. Chỉ dùng dữ liệu phù hợp với mục đích công việc và quyền được giao.",
      "Khi phát hiện truy cập bất thường hoặc sai dữ liệu, ngừng thao tác và liên hệ quản trị viên của đơn vị.",
    ],
  },
  {
    id: "copyright",
    icon: Copyright,
    title: "Bản quyền & ghi nhận",
    items: [
      "HooSoo là dự án cá nhân của Bùi Đức Đăng Khoa. Mã nguồn và giao diện của dự án không thuộc sản phẩm của doanh nghiệp thực tập.",
      "Các thư viện và phông chữ bên thứ ba giữ giấy phép của tác giả tương ứng. Inter được sử dụng theo SIL Open Font License.",
      "Việc công bố và sử dụng lại dự án cần tuân thủ quyền của tác giả và giấy phép của từng thành phần.",
    ],
  },
];
export function PoliciesPage() {
  useLocale();
  const { user } = useAuth();
  return (
    <main className="policies-page">
      <header className="policies-header">
        <Link to={user ? "/dashboard" : "/login"} className="brand">
          <span className="brand-mark">h.</span>HooSoo
        </Link>
        <HeaderTools />
      </header>
      <div className="policies-body">
        <Link className="text-link" to={user ? "/dashboard" : "/login"}>
          <ArrowLeft size={16} />
          {t("Quay lại")}
        </Link>
        <h1>{t("Chính sách & sử dụng")}</h1>
        <nav aria-label={t("Nội dung chính sách")}>
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`}>
              {t(s.title)}
            </a>
          ))}
        </nav>
        {sections.map((s) => (
          <section key={s.id} id={s.id}>
            <div className="policies-section-title">
              <s.icon size={23} />
              <h2>{t(s.title)}</h2>
            </div>
            {s.items.map((text) => (
              <p key={text}>{t(text)}</p>
            ))}
          </section>
        ))}
        <footer>© {new Date().getFullYear()} HooSoo · Bùi Đức Đăng Khoa</footer>
      </div>
    </main>
  );
}
