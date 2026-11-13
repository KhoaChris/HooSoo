import { useLocale } from "../../i18n";
import type { ComponentPropsWithRef } from "react";

export function Textarea({
  className = "",
  ...props
}: ComponentPropsWithRef<"textarea">) {
  useLocale();
  return (
    <textarea {...props} className={`textarea-control ${className}`.trim()} />
  );
}
