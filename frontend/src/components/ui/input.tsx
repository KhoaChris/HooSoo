import type { ComponentPropsWithRef } from "react";

/** Native input semantics and form refs, with the shared HooSoo appearance. */
export function Input({
  className = "",
  ...props
}: ComponentPropsWithRef<"input">) {
  return <input {...props} className={`input-control ${className}`.trim()} />;
}
