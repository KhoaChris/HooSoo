import { useState } from "react";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { Navigate, Link, useLocation } from "react-router-dom";
import { z } from "zod";
import { ArrowUpRight, ShieldCheck, Users } from "lucide-react";
import { auth, env } from "../../config/firebase";
import { useAuth } from "../../app/auth";
import { Form, Loading, ErrorBox, Button } from "../../components/ui";

export function Login({ forgot = false }: { forgot?: boolean }) {
  const session = useAuth(),
    location = useLocation();
  const [sent, setSent] = useState(false);
  if (session.loading) return <Loading />;
  if (session.user && session.error)
    return (
      <main className="access-error">
        <ErrorBox error={session.error} retry={session.retry} />
        <Button variant="secondary" onClick={() => void session.logout()}>
          Đăng xuất
        </Button>
      </main>
    );
  const from = (location.state as { from?: string } | null)?.from;
  const target =
    from?.startsWith("/") &&
    !from.startsWith("//") &&
    !from.startsWith("/login")
      ? from
      : "/dashboard";
  if (session.user && session.me) return <Navigate to={target} replace />;
  async function submit(v: Record<string, unknown>) {
    try {
      if (forgot) {
        await sendPasswordResetEmail(auth, String(v.email));
        setSent(true);
      } else
        await signInWithEmailAndPassword(
          auth,
          String(v.email),
          String(v.password),
        );
    } catch (e) {
      const code = (e as { code?: string }).code;
      throw new Error(
        code === "auth/network-request-failed"
          ? "Không kết nối được dịch vụ đăng nhập. Vui lòng kiểm tra kết nối và thử lại."
          : [
                "auth/configuration-not-found",
                "auth/operation-not-allowed",
                "auth/invalid-api-key",
              ].includes(code || "")
            ? "Dịch vụ đăng nhập chưa được cấu hình đầy đủ. Vui lòng liên hệ quản trị viên."
            : code === "auth/too-many-requests"
              ? "Quá nhiều lần thử. Vui lòng chờ rồi đăng nhập lại."
              : "Email hoặc mật khẩu chưa đúng, hoặc tài khoản không khả dụng.",
      );
    }
  }
  return (
    <main className="login-page">
      <section className="login-story">
        <div className="brand">
          <span className="brand-mark">h.</span>HooSoo
        </div>
        <span className="eyebrow">CON NGƯỜI LÀ TRỌNG TÂM</span>
        <h1>
          Một không gian.
          <br />
          Kết nối cả đội ngũ.
        </h1>
        <p>
          Quản lý công việc nhân sự hằng ngày, để bạn có thêm thời gian dành cho
          con người.
        </p>
        <div className="story-illustration">
          <div className="orbit-person">
            <Users size={42} />
          </div>
          <div className="story-line">
            <span />
            <span />
            <span />
          </div>
          <div className="story-nodes">
            <span>Nhân sự</span>
            <span>Đội ngũ</span>
            <span>Cá nhân</span>
          </div>
        </div>
        <footer>HooSoo · Dự án cá nhân của Bùi Đức Đăng Khoa</footer>
      </section>
      <section className="login-form">
        <div className="login-inner">
          <span className="eyebrow">CHÀO MỪNG ĐẾN HOOSOO</span>
          <h2>{forgot ? "Lấy lại mật khẩu" : "Bắt đầu ngày làm việc"}</h2>

          {sent ? (
            <div className="notice success">
              Nếu email có tài khoản, hướng dẫn khôi phục đã được gửi.{" "}
              {env.VITE_FIREBASE_MODE === "emulator" &&
                "Ở chế độ local, liên kết xuất hiện trong terminal Auth emulator."}
            </div>
          ) : (
            <Form
              schema={z.object({
                email: z.email("Email chưa hợp lệ"),
                ...(forgot
                  ? {}
                  : { password: z.string().min(1, "Vui lòng nhập mật khẩu") }),
              })}
              fields={[
                { name: "email", label: "Email công việc", type: "email" },
                ...(!forgot
                  ? [
                      {
                        name: "password",
                        label: "Mật khẩu",
                        type: "password" as const,
                      },
                    ]
                  : []),
              ]}
              onSubmit={submit}
              submitLabel={forgot ? "Gửi hướng dẫn" : "Đăng nhập"}
            />
          )}
          <Link
            className="text-link"
            to={forgot ? "/login" : "/forgot-password"}
          >
            {forgot ? "Quay lại đăng nhập" : "Quên mật khẩu?"}
            <ArrowUpRight size={16} />
          </Link>
          <div className="login-note">
            <ShieldCheck size={18} />
            <span>
              {env.VITE_FIREBASE_MODE === "emulator"
                ? "Môi trường demo riêng · Dữ liệu giả lập"
                : "Truy cập theo quyền được cấp"}
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
