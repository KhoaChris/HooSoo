import { useLocale } from "../../i18n";
import type { ComponentPropsWithRef } from "react";
import { Input } from "./input";

export function Checkbox({
  className = "",
  ...props
}: Omit<ComponentPropsWithRef<"input">, "type">) {
  useLocale();
  return (
    <Input
      {...props}
      type="checkbox"
      className={`checkbox-control ${className}`.trim()}
    />
  );
}
