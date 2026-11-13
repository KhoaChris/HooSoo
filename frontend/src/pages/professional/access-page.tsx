import { StableText } from "../../i18n/stable-text";
import { t, useLocale } from "../../i18n";
import { Link } from "react-router-dom";
import { ShieldCheck, ArrowUpRight } from "lucide-react";
import {
  roles,
  roleDefinitions,
  scopeLabels,
  professionalRoles,
  businessRoles,
  isSupervisorRole,
  labels,
} from "@hoosoo/shared";
import { useAuth } from "../../app/auth";
import { Heading } from "../../components/ui";
export function AccessPage() {
  useLocale();
  const { me } = useAuth(),
    role = me!.actor.role,
    def = roleDefinitions[role];
  return (
    <>
      <Heading title={t("Vai trò & quyền truy cập")} />
      <section className="access-current">
        <ShieldCheck size={26} />
        <div>
          <span className="section-eyebrow">{t("VAI TRÒ CỦA BẠN")}</span>
          <h2>
            <StableText>{t(def.label)}</StableText>
          </h2>
          <span>
            {t("Phạm vi:")} {t(scopeLabels[def.scope])}
          </span>
        </div>
        {role === "Admin" && (
          <Link className="button secondary" to="/settings/users">
            {t("Quản lý phân quyền")}
            <ArrowUpRight size={16} />
          </Link>
        )}
      </section>
      <div className="table-wrap access-matrix">
        <table>
          <caption>{t("Phân cấp và phạm vi nghiệp vụ")}</caption>
          <thead>
            <tr>
              <th>
                <StableText>{t("Vai trò")}</StableText>
              </th>
              <th>
                <StableText>{t("Phạm vi")}</StableText>
              </th>
              <th>
                <StableText>{t("Nhân sự")}</StableText>
              </th>
              <th>
                <StableText>{t("Phê duyệt")}</StableText>
              </th>
              <th>
                <StableText>{t("Chuyên môn")}</StableText>
              </th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r} className={r === role ? "access-selected" : ""}>
                <td>
                  <strong>
                    <StableText>{t(labels[r])}</StableText>
                  </strong>
                  <small className="workflow-cell-subtext">
                    <StableText>
                      {r === role
                        ? t("Vai trò hiện tại")
                        : roleDefinitions[r].rank === 10
                          ? t("Chuyên viên")
                          : r === "Admin"
                            ? t("Quản trị cao nhất")
                            : r === "Director"
                              ? t("Điều hành phòng ban")
                              : t("Quản lý / điều phối")}
                    </StableText>
                  </small>
                </td>
                <td>
                  <StableText>
                    {t(scopeLabels[roleDefinitions[r].scope])}
                  </StableText>
                </td>
                <td>
                  <StableText>
                    {r === "Admin"
                      ? t("Toàn quyền")
                      : businessRoles.includes(r)
                        ? t("Cấp thấp hơn")
                        : t("Chỉ xem theo phạm vi")}
                  </StableText>
                </td>
                <td>
                  <StableText>
                    {isSupervisorRole(r)
                      ? r === "HR"
                        ? t("Xác nhận cuối cấp dưới")
                        : t("Theo cấp & phân công")
                      : t("Gửi đề nghị cá nhân")}
                  </StableText>
                </td>
                <td>
                  {professionalRoles.includes(r)
                    ? roleDefinitions[r].areas
                        .map((area) =>
                          t(
                            {
                              delivery: "Điều phối",
                              engineering: "Phát triển",
                              quality: "Chất lượng",
                              analysis: "Nghiệp vụ",
                              design: "Thiết kế",
                              operations: "Vận hành",
                            }[area],
                          ),
                        )
                        .join(", ")
                    : t("Nghiệp vụ nhân sự / cá nhân")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
