import type { ComponentPropsWithRef } from "react";
import { Input } from "./input";

export function Checkbox({
  className = "",
  ...props
}: Omit<ComponentPropsWithRef<"input">, "type">) {
  return (
    <Input
      {...props}
      type="checkbox"
      className={`checkbox-control ${className}`.trim()}
    />
  );
}
