import type { ComponentPropsWithRef } from "react";

export function Textarea({
  className = "",
  ...props
}: ComponentPropsWithRef<"textarea">) {
  return (
    <textarea {...props} className={`textarea-control ${className}`.trim()} />
  );
}
