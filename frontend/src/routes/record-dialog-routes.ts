import { matchPath, type Location } from "react-router-dom";

/** These page URLs also work when opened directly, without a background page. */
export function recordDialogRoute(path: string) {
  if (matchPath("/employees/new", path))
    return { kind: "employee" as const, edit: false, fallback: "/employees" };
  if (matchPath("/leave/new", path))
    return { kind: "leave" as const, edit: false, fallback: "/leave/my" };
  const edit = matchPath("/employees/:employeeId/edit", path);
  if (edit)
    return {
      kind: "employee" as const,
      edit: true,
      fallback: `/employees/${edit.params.employeeId}`,
    };
  return undefined;
}

export function recordDialogBackground(
  location: Location,
): Location | undefined {
  const route = recordDialogRoute(location.pathname);
  if (!route) return undefined;
  const saved = location.state?.backgroundLocation as Location | undefined;
  if (
    saved?.pathname?.startsWith("/") &&
    !saved.pathname.startsWith("//") &&
    !recordDialogRoute(saved.pathname)
  )
    return saved;
  return {
    ...location,
    pathname: route.fallback,
    search: "",
    hash: "",
    state: null,
  };
}
