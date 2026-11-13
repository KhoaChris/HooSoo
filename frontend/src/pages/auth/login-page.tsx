import { StableText } from "../../i18n/stable-text";
import { t, useLocale } from "../../i18n";
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
  useLocale();
  const session = useAuth(),
    location = useLocation();
  const [sent, setSent] = useState(false);
  if (session.loading) return <Loading />;
  if (session.user && session.error)
    return (
      <main className="access-error">
        <ErrorBox error={session.error} retry={session.retry} />
        <Button variant="secondary" onClick={() => void session.logout()}>
          {t("Đăng xuất")}
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
          ? t(
              "Không kết nối được dịch vụ đăng nhập. Vui lòng kiểm tra kết nối và thử lại.",
            )
          : [
                "auth/configuration-not-found",
                "auth/operation-not-allowed",
                "auth/invalid-api-key",
              ].includes(code || "")
            ? t(
                "Dịch vụ đăng nhập chưa được cấu hình đầy đủ. Vui lòng liên hệ quản trị viên.",
              )
            : code === "auth/too-many-requests"
              ? t("Quá nhiều lần thử. Vui lòng chờ rồi đăng nhập lại.")
              : t(
                  "Email hoặc mật khẩu chưa đúng, hoặc tài khoản không khả dụng.",
                ),
      );
    }
  }
  return (
    <main className="login-page">
      <section className="login-story">
        <div className="brand">
          <span className="brand-mark">h.</span>HooSoo
        </div>
        <span className="eyebrow">
          <StableText>{t("CON NGƯỜI LÀ TRỌNG TÂM")}</StableText>
        </span>
        <h1>
          <StableText>{t("Một không gian.")}</StableText>
          <br />
          <StableText>{t("Kết nối cả đội ngũ.")}</StableText>
        </h1>
        <p>
          <StableText>
            {t(
              "Quản lý công việc nhân sự hằng ngày, để bạn có thêm thời gian dành cho con người.",
            )}
          </StableText>
        </p>
        <div className="story-illustration">
          <div className="orbit-person">
            <Users size={42} />
          </div>
          <div className="story-line" aria-hidden="true" />
          <div className="story-nodes">
            <span className="story-node">
              <StableText>{t("Nhân sự")}</StableText>
            </span>
            <span className="story-node">
              <StableText>{t("Đội ngũ")}</StableText>
            </span>
            <span className="story-node">
              <StableText>{t("Cá nhân")}</StableText>
            </span>
          </div>
        </div>
        <footer>{t("HooSoo · Dự án cá nhân của Bùi Đức Đăng Khoa")}</footer>
      </section>
      <section className="login-form">
        <div className="login-inner">
          <span className="eyebrow">
            <StableText>{t("CHÀO MỪNG ĐẾN HOOSOO")}</StableText>
          </span>
          <h2>
            <StableText>
              {forgot ? t("Lấy lại mật khẩu") : t("Bắt đầu ngày làm việc")}
            </StableText>
          </h2>

          {sent ? (
            <div className="notice success">
              {t("Nếu email có tài khoản, hướng dẫn khôi phục đã được gửi.")}{" "}
              {env.VITE_FIREBASE_MODE === "emulator" &&
                t(
                  "Ở chế độ local, liên kết xuất hiện trong terminal Auth emulator.",
                )}
            </div>
          ) : (
            <Form
              schema={z.object({
                email: z.email(t("Email chưa hợp lệ")),
                ...(forgot
                  ? {}
                  : {
                      password: z.string().min(1, t("Vui lòng nhập mật khẩu")),
                    }),
              })}
              fields={[
                { name: "email", label: t("Email công việc"), type: "email" },
                ...(!forgot
                  ? [
                      {
                        name: "password",
                        label: t("Mật khẩu"),
                        type: "password" as const,
                      },
                    ]
                  : []),
              ]}
              onSubmit={submit}
              submitLabel={forgot ? t("Gửi hướng dẫn") : t("Đăng nhập")}
            />
          )}
          <Link
            className="text-link"
            to={forgot ? "/login" : "/forgot-password"}
          >
            <StableText>
              {forgot ? t("Quay lại đăng nhập") : t("Quên mật khẩu?")}
            </StableText>
            <ArrowUpRight size={16} />
          </Link>
          <div className="login-note">
            <ShieldCheck size={18} />
            <span>
              <StableText>
                {env.VITE_FIREBASE_MODE === "emulator"
                  ? t("Môi trường demo riêng · Dữ liệu giả lập")
                  : t("Truy cập theo quyền được cấp")}
              </StableText>
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
