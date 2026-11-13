import { useLocale } from "../../i18n";
import { Link, useLocation, type LinkProps } from "react-router-dom";
import { recordDialogRoute } from "../../routes/record-dialog-routes";
import { Children } from "react";
import { StableText } from "../../i18n/stable-text";

/** Keep the originating page mounted while a create/edit dialog is open. */
export function DialogLink(props: LinkProps) {
  useLocale();
  const location = useLocation();
  const opensDialog =
    typeof props.to === "string" && !!recordDialogRoute(props.to);
  return (
    <Link
      {...props}
      children={Children.map(props.children, (child) =>
        typeof child === "string" && child.trim() ? (
          <StableText>{child}</StableText>
        ) : (
          child
        ),
      )}
      state={
        opensDialog
          ? { ...props.state, backgroundLocation: location }
          : props.state
      }
    />
  );
}
