import { t, useLocale } from "../../i18n";
import { type ReactNode } from "react";
import { StableText } from "../../i18n/stable-text";

export function Heading({
  eyebrow = t("KHÔNG GIAN LÀM VIỆC"),
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  useLocale();
  return (
    <header className={`page-heading${description ? "" : " is-compact"}`}>
      <div>
        <span className="eyebrow">
          <StableText>{eyebrow}</StableText>
        </span>
        <h1>
          <StableText>{title}</StableText>
        </h1>
        {description && (
          <p>
            <StableText>{description}</StableText>
          </p>
        )}
      </div>
      {action}
    </header>
  );
}
