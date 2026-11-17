import { useState } from "react";
import { Link } from "react-router-dom";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { ShieldCheck, KeyRound, ArrowUpRight } from "lucide-react";
import { useAuth } from "../../app/auth";
import { Heading, Button, Modal, Form } from "../../components/ui";
import { t, useLocale } from "../../i18n";
import { changePasswordSchema } from "./security-model";
export function SecurityPage() {
  useLocale();
  const { user, logout } = useAuth(),
    [edit, setEdit] = useState(false);
  return (
    <div>
      <Heading title={t("Bảo mật tài khoản")} />
      <section className="security-panel">
        <div className="security-panel-title">
          <ShieldCheck size={25} />
          <div>
            <h2>{t("Thông tin đăng nhập")}</h2>
            <p>{user?.email}</p>
          </div>
        </div>
        <div className="security-row">
          <div>
            <h3>{t("Mật khẩu")}</h3>
            <p>{t("Xác minh mật khẩu hiện tại trước khi thay đổi.")}</p>
          </div>
          <Button
            onClick={() => setEdit(true)}
            disabled={
              !user?.providerData.some((p) => p.providerId === "password")
            }
          >
            <KeyRound size={16} />
            {t("Đổi mật khẩu")}
          </Button>
        </div>
        <div className="security-row">
          <div>
            <h3>{t("Dữ liệu & quyền riêng tư")}</h3>
            <p>
              {t(
                "Quyền xem và xử lý dữ liệu phụ thuộc vai trò và phạm vi phụ trách.",
              )}
            </p>
          </div>
          <Link className="text-link" to="/policies">
            {t("Xem chính sách")}
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </section>
      {edit && (
        <Modal
          title={t("Đổi mật khẩu")}
          icon={<KeyRound size={22} />}
          onClose={() => setEdit(false)}
        >
          <p className="security-form-note">
            {t("Bạn sẽ đăng nhập lại sau khi đổi mật khẩu.")}
          </p>
          <Form
            schema={changePasswordSchema}
            defaults={{
              currentPassword: "",
              newPassword: "",
              confirmation: "",
            }}
            fields={[
              {
                name: "currentPassword",
                label: "Mật khẩu hiện tại",
                type: "password",
                required: true,
              },
              {
                name: "newPassword",
                label: "Mật khẩu mới",
                type: "password",
                required: true,
                hint: "Ít nhất 12 ký tự; có thể dùng một cụm từ dài.",
              },
              {
                name: "confirmation",
                label: "Xác nhận mật khẩu mới",
                type: "password",
                required: true,
              },
            ]}
            submitLabel={t("Đổi mật khẩu")}
            onCancel={() => setEdit(false)}
            onSubmit={async (body) => {
              if (!user?.email) throw new Error(t("Vui lòng đăng nhập lại."));
              try {
                await reauthenticateWithCredential(
                  user,
                  EmailAuthProvider.credential(
                    user.email,
                    String(body.currentPassword),
                  ),
                );
                await updatePassword(user, String(body.newPassword));
              } catch (error) {
                const code = (error as { code?: string }).code;
                throw new Error(
                  t(
                    code === "auth/invalid-credential" ||
                      code === "auth/wrong-password"
                      ? "Mật khẩu hiện tại không đúng."
                      : code === "auth/too-many-requests"
                        ? "Thử quá nhiều lần. Vui lòng chờ rồi thử lại."
                        : code === "auth/network-request-failed"
                          ? "Không kết nối được dịch vụ xác thực."
                          : "Không đổi được mật khẩu. Hãy kiểm tra lại hoặc đăng nhập lại.",
                  ),
                );
              }
              setEdit(false);
              await logout();
            }}
          />
        </Modal>
      )}
    </div>
  );
}
