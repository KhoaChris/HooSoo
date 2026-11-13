import { StableText } from "../../i18n/stable-text";
import { t, useLocale } from "../../i18n";
import { labels, workflowLabels } from "@hoosoo/shared";
import { statusTone } from "./status-tone";

export function Badge({ value }: { value: string }) {
  useLocale();
  return (
    <span
      className={`badge status-tone ${value}`}
      data-tone={statusTone(value)}
    >
      <StableText>
        {t(labels[value] || workflowLabels[value]) || value}
      </StableText>
    </span>
  );
}
