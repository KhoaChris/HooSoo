import { roles, roleDefinitions } from "@hoosoo/shared";
import {
  ShieldCheck,
  UsersRound,
  UserRound,
  BriefcaseBusiness,
} from "lucide-react";
import { labels, type Role } from "@hoosoo/shared";
export const roleDescriptions = Object.fromEntries(
  roles.map((r) => [r, roleDefinitions[r].description]),
) as Record<Role, string>;
export function RoleIcon({ role }: { role: Role }) {
  const Icon =
    (
      {
        Admin: ShieldCheck,
        HR: UsersRound,
        Manager: BriefcaseBusiness,
        Employee: UserRound,
      } as Partial<Record<Role, typeof UserRound>>
    )[role] || UserRound;
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
        {roles.map((role) => (
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
