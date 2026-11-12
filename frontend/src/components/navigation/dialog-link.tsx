import { Link, useLocation, type LinkProps } from "react-router-dom";
import { recordDialogRoute } from "../../routes/record-dialog-routes";

/** Keep the originating page mounted while a create/edit dialog is open. */
export function DialogLink(props: LinkProps) {
  const location = useLocation();
  const opensDialog =
    typeof props.to === "string" && !!recordDialogRoute(props.to);
  return (
    <Link
      {...props}
      state={
        opensDialog
          ? { ...props.state, backgroundLocation: location }
          : props.state
      }
    />
  );
}
