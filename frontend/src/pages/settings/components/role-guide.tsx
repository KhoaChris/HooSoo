import { t, useLocale } from "../../../i18n";
import { roles, roleDefinitions, scopeLabels } from "@hoosoo/shared";
import {
  ShieldCheck,
  UsersRound,
  UserRound,
  BriefcaseBusiness,
} from "lucide-react";
import { labels, type Role } from "@hoosoo/shared";
export function RoleIcon({ role }: { role: Role }) {
  useLocale();
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
  useLocale();
  return (
    <details className="role-guide">
      <summary>
        <ShieldCheck size={16} />
        {t("Phạm vi của từng vai trò")}
      </summary>
      <dl>
        {roles.map((role) => (
          <div key={role}>
            <dt>
              <RoleIcon role={role} />
              {t(labels[role])}
            </dt>
            <dd>{t(scopeLabels[roleDefinitions[role].scope])}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
