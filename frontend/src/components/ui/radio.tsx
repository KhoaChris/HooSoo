import type { ComponentPropsWithRef } from "react";
import { Input } from "./input";

/** Custom appearance with native radio-group and arrow-key behavior. */
export function Radio({
  className = "",
  ...props
}: Omit<ComponentPropsWithRef<"input">, "type">) {
  return (
    <Input
      {...props}
      type="radio"
      className={`selection-control radio-control ${className}`.trim()}
    />
  );
}
