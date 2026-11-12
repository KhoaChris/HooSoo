import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import {
  API_FRESH_MS,
  apiCacheDefaults,
  apiQueryOptions,
  canonicalApiPath,
  catalogPage,
  catalogPath,
  navigationWarmupPaths,
  warmNavigation,
} from "../src/services/query-cache";
import { cancelRefresh, refreshQueries } from "../src/services/query-sync";
import { readChanges } from "../src/services/live-updates";

const clients: QueryClient[] = [];
const clientFor = (staleTime = API_FRESH_MS) => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { ...apiCacheDefaults, staleTime, retry: false },
    },
  });
  clients.push(client);
  return client;
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-11T12:00:00Z"));
});
afterEach(() => {
  for (const client of clients.splice(0)) {
    cancelRefresh(client);
    client.clear();
  }
  vi.useRealTimers();
});

describe("Navigation cache", () => {
  it("reduces three employee/department/position navigation rounds from 15 GETs to 3", async () => {
    const simulate = async (optimized: boolean) => {
      const client = clientFor(optimized ? API_FRESH_MS : 15_000);
      const read = vi.fn(async () => ({
        items: [],
        page: 1,
        pageSize: 100,
        total: 0,
      }));
      const options = (path: string) =>
        optimized
          ? apiQueryOptions(path, "admin", read)
          : { queryKey: ["api", path], queryFn: read };
      const screens = [
        [
          "/employees?page=1",
          catalogPath("departments"),
          catalogPath("positions"),
        ],
        [optimized ? catalogPath("departments") : "/departments?page=1"],
        [optimized ? catalogPath("positions") : "/positions?page=1"],
      ];
      if (optimized) {
        const stop = warmNavigation(client, "admin", "Admin", read, () => true);
        await vi.advanceTimersByTimeAsync(500);
        stop();
      }
      for (let round = 0; round < 3; round++)
        for (const screen of screens) {
          const unsubscribe = screen.map((path) =>
            new QueryObserver(client, options(path)).subscribe(() => {}),
          );
          await vi.advanceTimersByTimeAsync(0);
          unsubscribe.forEach((fn) => fn());
          await vi.advanceTimersByTimeAsync(20_000);
        }
      return read.mock.calls.length;
    };
    expect(await simulate(false)).toBe(15);
    expect(await simulate(true)).toBe(3);
  });

  it("reuses parameter-order variants but separates user identities", async () => {
    const client = clientFor();
    const read = vi.fn(async () => ({ name: "Authorized result" }));
    await client.fetchQuery(
      apiQueryOptions("/employees?status=active&page=1", "admin", read),
    );
    await client.fetchQuery(
      apiQueryOptions("/employees?page=1&status=active", "admin", read),
    );
    expect(read).toHaveBeenCalledOnce();
    await client.fetchQuery(
      apiQueryOptions("/employees?page=1&status=active", "manager", read),
    );
    expect(read).toHaveBeenCalledTimes(2);
    expect(canonicalApiPath("/employees?search=A%26B&page=1")).toBe(
      "/employees?page=1&search=A%26B",
    );
  });

  it("refreshes on stale remount, keeps live data invalidatable, and protects session checks", async () => {
    const client = clientFor();
    const read = vi.fn(async () => ({}));
    const options = apiQueryOptions("/departments?pageSize=100", "admin", read);
    await client.fetchQuery(options);
    await vi.advanceTimersByTimeAsync(API_FRESH_MS - 1);
    let unsubscribe = new QueryObserver(client, options).subscribe(() => {});
    await vi.advanceTimersByTimeAsync(0);
    expect(read).toHaveBeenCalledOnce();
    unsubscribe();
    await vi.advanceTimersByTimeAsync(2);
    const observer = new QueryObserver(client, options);
    unsubscribe = observer.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(0);
    expect(read).toHaveBeenCalledTimes(2);
    expect(observer.shouldFetchOnWindowFocus()).toBe(false);
    expect(observer.shouldFetchOnReconnect()).toBe(false);
    expect(apiQueryOptions("/me", "admin", read).staleTime).toBe(60_000);
    expect(apiQueryOptions("/me", "admin", read).refetchOnWindowFocus).toBe(
      true,
    );
    expect(apiQueryOptions("/system/status", "admin", read).staleTime).toBe(0);
    unsubscribe();
  });

  it("shares the full bounded catalog across dropdowns and table pages", () => {
    const items = Array.from({ length: 25 }, (_, i) => ({
      id: String(i),
      employeeCount: i,
    }));
    const full = { items, total: 25, page: 1, pageSize: 100 };
    expect(catalogPage(full, 1)).toEqual({
      ...full,
      items: items.slice(0, 20),
      pageSize: 20,
    });
    expect(catalogPage(full, 2)).toEqual({
      ...full,
      items: items.slice(20),
      page: 2,
      pageSize: 20,
    });
    expect(full.items).toHaveLength(25);
    expect(catalogPage(undefined, 1)).toBeUndefined();
  });

  it("warms only permitted small lists and stops speculative reads on quota failure", async () => {
    expect(navigationWarmupPaths("Employee")).not.toContain(
      "/employees?page=1",
    );
    expect(navigationWarmupPaths("Admin")).toHaveLength(3);
    const client = clientFor();
    const read = vi
      .fn()
      .mockRejectedValue({ code: "FIRESTORE_QUOTA_EXCEEDED" });
    const stop = warmNavigation(client, "admin", "Admin", read, () => true);
    await vi.advanceTimersByTimeAsync(500);
    expect(read).toHaveBeenCalledOnce();
    stop();
  });

  it("cancels scheduled warmup when signed out and cannot refill a cleared account cache", async () => {
    const client = clientFor();
    const read = vi.fn(async () => ({}));
    let stop = warmNavigation(client, "admin", "Admin", read, () => true);
    stop();
    await vi.advanceTimersByTimeAsync(500);
    expect(read).not.toHaveBeenCalled();
    let resolve!: (data: object) => void;
    let current = true;
    read.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    stop = warmNavigation(client, "admin", "Admin", read, () => current);
    await vi.advanceTimersByTimeAsync(500);
    current = false;
    stop();
    client.clear();
    resolve({ secret: "Old account" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(read).toHaveBeenCalledOnce();
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });
});

describe("Cache synchronization", () => {
  it("refreshes the changed catalog, marks inactive pages stale, and leaves unrelated cache warm", async () => {
    const client = clientFor();
    const read = vi.fn(async (path: string) => ({
      path,
      revision: read.mock.calls.length,
    }));
    const dept = apiQueryOptions(catalogPath("departments"), "admin", read);
    const positions = apiQueryOptions(catalogPath("positions"), "admin", read);
    const tree = apiQueryOptions("/organization/tree", "admin", read);
    await Promise.all([
      client.fetchQuery(dept),
      client.fetchQuery(positions),
      client.fetchQuery(tree),
    ]);
    const unsubscribe = new QueryObserver(client, dept).subscribe(() => {});
    // A real SSE frame, parsed by the production decoder, triggers invalidation.
    let refreshed: Promise<void> | undefined;
    await readChanges(
      new ReadableStream({
        start(c) {
          c.enqueue(
            new TextEncoder().encode(
              'event: changed\ndata: {"version":"new","collections":["departments"]}\n\n',
            ),
          );
          c.close();
        },
      }),
      (_version, collections) => {
        refreshed = refreshQueries(client, collections ?? null);
      },
    );
    await vi.advanceTimersByTimeAsync(150);
    await refreshed;
    expect(read).toHaveBeenCalledTimes(4);
    expect(client.getQueryState(tree.queryKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(positions.queryKey)?.isInvalidated).toBe(false);
    await client.fetchQuery(positions);
    expect(read).toHaveBeenCalledTimes(4);
    await client.fetchQuery(tree);
    expect(read).toHaveBeenCalledTimes(5);
    unsubscribe();
  });

  it("cannot let a pre-commit GET overwrite newer data after a mutation/live change", async () => {
    const client = clientFor();
    let oldResponse!: (value: string) => void;
    const read = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            oldResponse = resolve;
          }),
      )
      .mockResolvedValue("after-commit");
    const options = apiQueryOptions(catalogPath("departments"), "admin", read);
    const unsubscribe = new QueryObserver(client, options).subscribe(() => {});
    await vi.advanceTimersByTimeAsync(0);
    const updated = refreshQueries(client, ["departments"]);
    await vi.advanceTimersByTimeAsync(150);
    await updated;
    expect(client.getQueryData(options.queryKey)).toBe("after-commit");
    oldResponse("before-commit");
    await vi.advanceTimersByTimeAsync(0);
    expect(client.getQueryData(options.queryKey)).toBe("after-commit");
    expect(read).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("marks every role-scoped query stale when membership permissions change", async () => {
    const client = clientFor();
    const read = vi.fn(async () => ({}));
    const paths = [
      "/me",
      "/employees?page=1",
      "/leave-requests?mine=true",
      catalogPath("positions"),
    ];
    await Promise.all(
      paths.map((path) =>
        client.fetchQuery(apiQueryOptions(path, "admin", read)),
      ),
    );
    const updated = refreshQueries(client, ["memberships"]);
    await vi.advanceTimersByTimeAsync(150);
    await updated;
    expect(
      client
        .getQueryCache()
        .getAll()
        .every((q) => q.state.isInvalidated),
    ).toBe(true);
    expect(read).toHaveBeenCalledTimes(4);
  });
});

it("never warms a restricted personnel endpoint for specialist roles", () => {
  for (const role of [
    "Developer",
    "QA",
    "QC",
    "BA",
    "Designer",
    "DevOps",
    "Employee",
  ] as const)
    expect(navigationWarmupPaths(role)).not.toContain("/employees?page=1");
  for (const role of [
    "Director",
    "DeputyManager",
    "ProjectManager",
    "TeamLead",
  ] as const)
    expect(navigationWarmupPaths(role)).toContain("/employees?page=1");
});
