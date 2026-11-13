import { useLocale } from "../../i18n";
import type { ComponentPropsWithRef } from "react";

/** Native input semantics and form refs, with the shared HooSoo appearance. */
export function Input({
  className = "",
  ...props
}: ComponentPropsWithRef<"input">) {
  useLocale();
  return <input {...props} className={`input-control ${className}`.trim()} />;
}
