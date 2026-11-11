import { type QueryClient, queryOptions } from "@tanstack/react-query";
import type { Page, Role } from "@hoosoo/shared";

export const API_FRESH_MS = 5 * 60_000;
export const API_RETAIN_MS = 30 * 60_000;
export const apiCacheDefaults = {
  staleTime: API_FRESH_MS,
  gcTime: API_RETAIN_MS,
  refetchOnWindowFocus: false,
  refetchOnReconnect: true,
} as const;

export function canonicalApiPath(path: string) {
  const [route, search = ""] = path.split("?");
  const params = new URLSearchParams(search);
  params.sort();
  const suffix = params.toString();
  return route + (suffix ? "?" + suffix : "");
}

export function apiQueryOptions<T>(
  path: string,
  uid: string | null,
  read: (path: string, signal: AbortSignal) => Promise<T>,
) {
  const canonical = canonicalApiPath(path);
  const route = canonical.split("?")[0];
  return queryOptions({
    // A late response for an old account can never become another account's data.
    queryKey: ["api", canonical, uid] as const,
    queryFn: ({ signal }) => read(canonical, signal),
    ...apiCacheDefaults,
    staleTime:
      route === "/me"
        ? 60_000
        : route.startsWith("/system/")
          ? 0
          : API_FRESH_MS,
    refetchOnWindowFocus: route === "/me",
  });
}

export const catalogPath = (kind: "departments" | "positions") =>
  `/${kind}?pageSize=100`;

// The existing API caps departments at 25 and positions at 50. A single bounded
// response serves both the dropdowns and the paginated catalog screen.
export function catalogPage<T>(
  data: Page<T> | undefined,
  page: number,
): Page<T> | undefined {
  if (!data) return undefined;
  const pageSize = 20;
  return {
    ...data,
    items: data.items.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
  };
}

export function navigationWarmupPaths(role: Role) {
  return [
    catalogPath("departments"),
    catalogPath("positions"),
    ...(role === "Employee" ? [] : ["/employees?page=1"]),
  ];
}

export function warmNavigation(
  client: QueryClient,
  uid: string,
  role: Role,
  read: (path: string, signal: AbortSignal) => Promise<unknown>,
  isCurrent: () => boolean,
) {
  let stopped = false;
  // Let the initial screen and live connection go first. Warm only small,
  // commonly shared lists, sequentially; never preload all audit/history data.
  const timer = setTimeout(() => {
    void (async () => {
      for (const path of navigationWarmupPaths(role)) {
        if (stopped || !isCurrent()) return;
        try {
          await client.fetchQuery({
            ...apiQueryOptions(path, uid, read),
            retry: false,
          });
        } catch {
          // An outage/quota failure stops speculative reads immediately.
          return;
        }
      }
    })();
  }, 500);
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
