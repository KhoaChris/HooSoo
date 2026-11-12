import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { queryAffected, mutationCollections } from "@hoosoo/shared";
import {
  refreshQueries,
  cancelRefresh,
} from "../../frontend/src/services/query-sync";

afterEach(() => vi.useRealTimers());
describe("Targeted client synchronization", () => {
  it("refreshes new workflow scopes without reloading unrelated directories or CV bytes", () => {
    for (const path of [
      "/work-registrations?mine=true",
      "/work-registrations?approvals=true",
    ])
      expect(queryAffected(path, ["workRegistrations"])).toBe(true);
    expect(
      queryAffected("/internal-requests?approvals=true", ["internalRequests"]),
    ).toBe(true);
    expect(
      queryAffected(
        "/attendance?mine=true",
        mutationCollections("/internal-requests/123/approve"),
      ),
    ).toBe(true);
    expect(
      queryAffected(
        "/attendance?mine=true",
        mutationCollections("/internal-requests"),
      ),
    ).toBe(false);
    expect(
      queryAffected("/recruitment/jobs/job/candidates", ["candidates"]),
    ).toBe(true);
    expect(
      queryAffected(
        "/recruitment/jobs",
        mutationCollections("/recruitment/candidates/123/move"),
      ),
    ).toBe(false);
    expect(
      queryAffected("/employees?page=1", ["internalRequests", "candidates"]),
    ).toBe(false);
  });
  it("refreshes affected screens and preserves authorization invalidation", () => {
    expect(queryAffected("/me", ["departments", "auditLogs"])).toBe(false);
    expect(queryAffected("/organization/tree", ["departments"])).toBe(true);
    expect(queryAffected("/leave-requests?mine=true", ["departments"])).toBe(
      false,
    );
    expect(queryAffected("/attendance/today", ["leaveRequests"])).toBe(true);
    expect(queryAffected("/leave-requests", ["memberships"])).toBe(true);
    expect(queryAffected("/me", ["employees"])).toBe(true);
    expect(queryAffected("/me", null)).toBe(true);
  });
  it("combines mutation and SSE signals into one refetch and cancels on sign-out", async () => {
    vi.useFakeTimers();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    const org = vi.fn().mockResolvedValue({ departments: [] });
    const me = vi.fn().mockResolvedValue({ name: "Admin" });
    const orgObserver = new QueryObserver(client, {
      queryKey: ["api", "/organization/tree"],
      queryFn: org,
    });
    const meObserver = new QueryObserver(client, {
      queryKey: ["api", "/me"],
      queryFn: me,
    });
    const unsubscribe = [
      orgObserver.subscribe(() => {}),
      meObserver.subscribe(() => {}),
    ];
    await vi.advanceTimersByTimeAsync(0);
    const mutation = refreshQueries(client, ["departments"]);
    const stream = refreshQueries(client, ["departments", "auditLogs"]);
    expect(mutation).toBe(stream);
    await vi.advanceTimersByTimeAsync(150);
    await mutation;
    expect(org).toHaveBeenCalledTimes(2);
    expect(me).toHaveBeenCalledOnce();
    const cancelled = refreshQueries(client, null);
    cancelRefresh(client);
    await cancelled;
    await vi.advanceTimersByTimeAsync(1000);
    expect(org).toHaveBeenCalledTimes(2);
    unsubscribe.forEach((fn) => fn());
    client.clear();
  });
});
