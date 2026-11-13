import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ subscribe: vi.fn(), stop: vi.fn() }));
vi.mock("../src/database/store", () => ({
  organization: { onSnapshot: mock.subscribe },
  tables: [
    "employees",
    "memberships",
    "departments",
    "auditLogs",
    "chatRooms",
    "chatMessages",
  ],
}));
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  mock.subscribe.mockReset().mockReturnValue(mock.stop);
  mock.stop.mockReset();
});
afterEach(() => vi.useRealTimers());
describe("Shared Firestore listener", () => {
  it("backs off a listener quota failure without disabling available foreground operations", async () => {
    const { subscribeChanges, assertLiveAvailable } =
      await import("../src/database/live-hub");
    const { firestoreOperation } =
      await import("../src/database/firestore-operation");
    const error = vi.fn();
    const stop = subscribeChanges({ change: vi.fn(), error });
    mock.subscribe.mock.calls[0][1]({ code: 8 });
    expect(error).toHaveBeenCalledOnce();
    expect(assertLiveAvailable).toThrow();
    const deferredError = vi.fn();
    const closePending = subscribeChanges({
      change: vi.fn(),
      error: deferredError,
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(deferredError).toHaveBeenCalledOnce();
    expect(mock.subscribe).toHaveBeenCalledOnce();
    closePending();
    await expect(
      firestoreOperation(async () => "accepted by Firestore"),
    ).resolves.toBe("accepted by Firestore");
    stop();
    await vi.advanceTimersByTimeAsync(60000);
    expect(assertLiveAvailable).not.toThrow();
  });
  it("uses one upstream listener for many tabs, reads nothing while idle and releases the last subscriber", async () => {
    const { subscribeChanges } = await import("../src/database/live-hub");
    const { usageSnapshot } =
      await import("../src/observability/firestore-usage");
    const observers = Array.from({ length: 8 }, () => ({
      change: vi.fn(),
      error: vi.fn(),
    }));
    const stop = observers.map(subscribeChanges);
    expect(mock.subscribe).toHaveBeenCalledOnce();
    const emit = mock.subscribe.mock.calls[0][0];
    emit({
      get: () => ({ departments: 1 }),
      updateTime: { seconds: 1, nanoseconds: 1 },
    });
    expect(observers.every((o) => o.change.mock.calls.length === 1)).toBe(true);
    await vi.advanceTimersByTimeAsync(600000);
    expect(usageSnapshot().total.reads).toBe(1);
    emit({
      get: () => ({ departments: 2 }),
      updateTime: { seconds: 1, nanoseconds: 2 },
    });
    expect(observers[0].change.mock.calls[1][0].collections).toEqual([
      "departments",
    ]);
    expect(usageSnapshot().total.reads).toBe(2);
    for (const close of stop.slice(0, -1)) close();
    expect(mock.stop).not.toHaveBeenCalled();
    stop.at(-1)!();
    expect(mock.stop).toHaveBeenCalledOnce();
  });
});

it("keeps coalesced chat audiences while suppressing unrelated chat refreshes", async () => {
  const { subscribeChanges, visibleCollections } =
    await import("../src/database/live-hub");
  const change = vi.fn(),
    stop = subscribeChanges({ change, error: vi.fn() });
  const emit = mock.subscribe.mock.calls[0][0];
  emit({
    get: (key: string) =>
      key === "collectionVersions"
        ? { chatRooms: 1, employees: 1 }
        : { a: 1, b: 1 },
    updateTime: { seconds: 1, nanoseconds: 1 },
  });
  emit({
    get: (key: string) =>
      key === "collectionVersions"
        ? { chatRooms: 3, employees: 1 }
        : { a: 2, b: 2, c: 1 },
    updateTime: { seconds: 1, nanoseconds: 2 },
  });
  const event = change.mock.calls[1][0];
  expect(event.chatMemberIds).toEqual(["a", "b", "c"]);
  expect(visibleCollections(event, "a")).toEqual(["chatRooms"]);
  expect(visibleCollections(event, "admin-outsider")).toEqual([]);
  expect(
    visibleCollections(
      { ...event, collections: ["chatRooms", "employees"] },
      "admin-outsider",
    ),
  ).toEqual(["employees"]);
  expect(
    visibleCollections({ ...event, collections: null }, "admin-outsider"),
  ).toBeNull();
  stop();
});
