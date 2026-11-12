import {
  ShieldCheck,
  UsersRound,
  UserRound,
  BriefcaseBusiness,
} from "lucide-react";
import { labels, type Role } from "@hoosoo/shared";
export const roleDescriptions: Record<Role, string> = {
  Admin:
    "Quản lý toàn bộ nhân sự, tài khoản, doanh nghiệp và nhật ký thao tác.",
  HR: "Quản lý hồ sơ, chấm công, nghỉ phép và chính sách nhân sự toàn doanh nghiệp.",
  Manager:
    "Theo dõi và duyệt nghỉ phép cho nhân viên trực thuộc trong cùng phòng ban.",
  Employee: "Xem hồ sơ cá nhân, chấm công và gửi yêu cầu nghỉ phép của mình.",
};
export function RoleIcon({ role }: { role: Role }) {
  const Icon =
    {
      Admin: ShieldCheck,
      HR: UsersRound,
      Manager: BriefcaseBusiness,
      Employee: UserRound,
    }[role] || UserRound;
  return <Icon size={15} aria-hidden="true" />;
}
export function RoleGuide() {
  return (
    <details className="role-guide">
      <summary>
        <ShieldCheck size={16} />
        Phạm vi của từng vai trò
      </summary>
      <dl>
        {(["Admin", "HR", "Manager", "Employee"] as Role[]).map((role) => (
          <div key={role}>
            <dt>
              <RoleIcon role={role} />
              {labels[role]}
            </dt>
            <dd>{roleDescriptions[role]}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
