import { useLocale } from "../../i18n";
import { useState } from "react";

/** Uses the thumbnail already in the employee response: no per-avatar request. */
export function Avatar({
  name,
  src,
  className = "avatar",
}: {
  name: string;
  src?: string | null;
  className?: string;
}) {
  useLocale();
  const [failed, setFailed] = useState<string | null>(null);
  const valid = src?.startsWith("data:image/webp;base64,") && failed !== src;
  return (
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
}
