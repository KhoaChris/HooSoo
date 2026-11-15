import { presenceLabels } from "@hoosoo/shared";
import { usePresence, presenceStatus } from "../../services/presence-state";
import { t } from "../../i18n";
import "../../style/components/presence.css";
import { useLocale } from "../../i18n";
import { useState } from "react";

/** Uses the thumbnail already in the employee response: no per-avatar request. */
export function Avatar({
  name,
  src,
  className = "avatar",
  employeeId,
}: {
  name: string;
  employeeId?: string;
  src?: string | null;
  className?: string;
}) {
  useLocale();
  usePresence();
  const status = presenceStatus(employeeId);
  const [failed, setFailed] = useState<string | null>(null);
  const valid = src?.startsWith("data:image/webp;base64,") && failed !== src;
  const avatar = (
    <span className={`person-avatar ${className}`} aria-hidden="true">
      {valid && src ? (
        <img src={src} alt="" decoding="async" onError={() => setFailed(src)} />
      ) : (
        name
          .trim()
          .split(/\s+/)
          .slice(-2)
          .map((w) => w[0])
          .join("")
          .toLocaleUpperCase("vi")
      )}
    </span>
  );
  return employeeId ? (
    <span className="presence-avatar" title={t(presenceLabels[status])}>
      {avatar}
      <i
        className="presence-dot"
        data-state={status}
        role="img"
        aria-label={t(presenceLabels[status])}
      />
    </span>
  ) : (
    avatar
  );
}
