import { useLocale } from "../../i18n";
import { LoaderCircle } from "lucide-react";
import { Children } from "react";
import { StableText } from "../../i18n/stable-text";

export type ButtonTone = "danger" | "success";

export function Button({
  children,
  variant = "primary",
  tone,
  busy = false,
  ...props
}: React.ComponentPropsWithRef<"button"> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  tone?: ButtonTone;
  busy?: boolean;
}) {
  useLocale();
  return (
    <button
      {...props}
      data-tone={variant === "danger" ? "danger" : tone}
      disabled={busy || props.disabled}
      className={`button ${variant} ${props.className || ""}`}
    >
      {busy && <LoaderCircle size={16} className="spin" />}
      {Children.map(children, (child) =>
        typeof child === "string" && child.trim() ? (
          <StableText>{child}</StableText>
        ) : (
          child
        ),
      )}
    </button>
  );
}
