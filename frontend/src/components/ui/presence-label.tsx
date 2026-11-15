import { presenceLabels } from "@hoosoo/shared";
import { usePresence, presenceStatus } from "../../services/presence-state";
import { t, useLocale } from "../../i18n";
export function PresenceLabel({ employeeId }: { employeeId?: string }) {
  usePresence();
  useLocale();
  const status = presenceStatus(employeeId);
  return (
    <span className="presence-label" data-state={status}>
      <i aria-hidden="true" />
      {t(presenceLabels[status])}
    </span>
  );
}
