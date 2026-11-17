import type { ComponentPropsWithRef } from "react";
import { Input } from "./input";

/** A boolean form control; checked state and Space use native input behavior. */
export function Switch({
  className = "",
  ...props
}: Omit<ComponentPropsWithRef<"input">, "type" | "role">) {
  return (
    <Input
      {...props}
      type="checkbox"
      role="switch"
      className={`selection-control switch-control ${className}`.trim()}
    />
  );
}
