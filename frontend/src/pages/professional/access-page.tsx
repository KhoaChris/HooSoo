import { Link } from "react-router-dom";
import { ShieldCheck, ArrowUpRight, LockKeyhole } from "lucide-react";
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
  const { me } = useAuth(),
    role = me!.actor.role,
    def = roleDefinitions[role];
  return (
    <>
      <Heading
        title="Vai trò & quyền truy cập"
        description="Quyền được cấp theo vai trò; tên chức danh không tự mở thêm quyền."
      />
      <section className="access-current">
        <ShieldCheck size={26} />
        <div>
          <span className="section-eyebrow">VAI TRÒ CỦA BẠN</span>
          <h2>{def.label}</h2>
          <p>{def.description}</p>
          <span>Phạm vi: {scopeLabels[def.scope]}</span>
        </div>
        {role === "Admin" && (
          <Link className="button secondary" to="/settings/users">
            Quản lý phân quyền
            <ArrowUpRight size={16} />
          </Link>
        )}
      </section>
      <div className="access-rule">
        <LockKeyhole size={18} />
        <p>
          Cấp dưới không được sửa hồ sơ hoặc xử lý dữ liệu của cấp ngang hàng và
          cấp trên. Chỉ Admin được cấp tài khoản và đổi vai trò. Mọi thao tác
          vẫn phải nằm trong phạm vi được giao.
        </p>
      </div>
      <div className="table-wrap access-matrix">
        <table>
          <caption>Phân cấp và phạm vi nghiệp vụ</caption>
          <thead>
            <tr>
              <th>Vai trò</th>
              <th>Phạm vi</th>
              <th>Nhân sự</th>
              <th>Phê duyệt</th>
              <th>Chuyên môn</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r} className={r === role ? "access-selected" : ""}>
                <td>
                  <strong>{labels[r]}</strong>
                  <small className="workflow-cell-subtext">
                    {r === role
                      ? "Vai trò hiện tại"
                      : roleDefinitions[r].rank === 10
                        ? "Chuyên viên"
                        : r === "Admin"
                          ? "Quản trị cao nhất"
                          : r === "Director"
                            ? "Điều hành phòng ban"
                            : "Quản lý / điều phối"}
                  </small>
                </td>
                <td>{scopeLabels[roleDefinitions[r].scope]}</td>
                <td>
                  {r === "Admin"
                    ? "Toàn quyền"
                    : businessRoles.includes(r)
                      ? "Cấp thấp hơn"
                      : "Chỉ xem theo phạm vi"}
                </td>
                <td>
                  {isSupervisorRole(r)
                    ? r === "HR"
                      ? "Xác nhận cuối cấp dưới"
                      : "Theo cấp & phân công"
                    : "Gửi đề nghị cá nhân"}
                </td>
                <td>
                  {professionalRoles.includes(r)
                    ? roleDefinitions[r].areas
                        .map(
                          (a) =>
                            ({
                              delivery: "Điều phối",
                              engineering: "Phát triển",
                              quality: "Chất lượng",
                              analysis: "Nghiệp vụ",
                              design: "Thiết kế",
                              operations: "Vận hành",
                            })[a],
                        )
                        .join(", ")
                    : "Nghiệp vụ nhân sự / cá nhân"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="workflow-help">
        PM và Trưởng nhóm cùng cấp; QA, QC, BA, Designer, Developer và DevOps
        cùng cấp chuyên viên, khác quyền chuyên môn. Giám đốc và Trưởng phòng
        phụ trách phòng ban; Phó phòng, PM và Trưởng nhóm phụ trách nhân viên
        được gán quản lý trực tiếp.
      </p>
    </>
  );
}
