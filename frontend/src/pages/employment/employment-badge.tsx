import {
  employmentStatusLabels,
  type EmploymentSection,
  type EmploymentView,
} from "@hoosoo/shared";
import { statusTone } from "../../components/ui/status-tone";
import { t } from "../../i18n";
import { today } from "../workflows/workflow-ui";
import { itemStatus } from "./employment-model";
export function EmploymentBadge({
  section,
  item,
}: {
  section: EmploymentSection;
  item: EmploymentView;
}) {
  const status = itemStatus(section, item, today());
  return (
    <span
      className="employment-badge status-tone"
      data-tone={
        status === "expired"
          ? "danger"
          : status === "expiring"
            ? "warning"
            : statusTone(status)
      }
    >
      {t(employmentStatusLabels[status])}
    </span>
  );
}
