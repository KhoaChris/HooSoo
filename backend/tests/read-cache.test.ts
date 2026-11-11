import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("Invalidated backend read cache", () => {
  it("retains results only while the upstream live listener is healthy and never shares mutable state", async () => {
    const cache = await import("../src/database/read-cache");
    const load = vi.fn(async () => ({ name: "Department" }));
    await cache.cachedRead("departments", "all", load);
    await cache.cachedRead("departments", "all", load);
    expect(load).toHaveBeenCalledTimes(2);
    cache.setReadCacheLive(true);
    const first = await cache.cachedRead("departments", "all", load);
    first.name = "Local mutation";
    expect(await cache.cachedRead("departments", "all", load)).toEqual({
      name: "Department",
    });
    expect(load).toHaveBeenCalledTimes(3);
    cache.setReadCacheLive(false);
    await cache.cachedRead("departments", "all", load);
    expect(load).toHaveBeenCalledTimes(4);
    expect(cache.readCacheSnapshot().entries).toBe(0);
  });
  it("does not retain authorization reads, and invalidates only changed tables", async () => {
    const cache = await import("../src/database/read-cache");
    cache.setReadCacheLive(true);
    const load = vi.fn(async () => ({}));
    for (let i = 0; i < 2; i++) {
      await cache.cachedRead("memberships", "current", load);
      await cache.cachedRead("employees", "current", load, { fresh: true });
    }
    expect(load).toHaveBeenCalledTimes(4);
    await cache.cachedRead("departments", "all", load);
    await cache.cachedRead("positions", "all", load);
    cache.invalidateReadCache(["departments"]);
    await cache.cachedRead("departments", "all", load);
    await cache.cachedRead("positions", "all", load);
    expect(load).toHaveBeenCalledTimes(7);
  });
  it("cannot refill the cache with an in-flight response from before a commit", async () => {
    const cache = await import("../src/database/read-cache");
    cache.setReadCacheLive(true);
    let finish!: (value: string) => void;
    const load = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<string>((done) => {
            finish = done;
          }),
      )
      .mockResolvedValue("new");
    const old = cache.cachedRead("departments", "all", load);
    await vi.advanceTimersByTimeAsync(0);
    const joined = cache.cachedRead("departments", "all", load);
    cache.invalidateReadCache(["departments"]);
    expect(await cache.cachedRead("departments", "all", load)).toBe("new");
    finish("old");
    await Promise.all([old, joined]);
    expect(await cache.cachedRead("departments", "all", load)).toBe("new");
    expect(load).toHaveBeenCalledTimes(2);
  });
  it("expires data and does not retain failures or grow without bounds", async () => {
    const cache = await import("../src/database/read-cache");
    cache.setReadCacheLive(true);
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ value: 1 });
    await expect(cache.cachedRead("positions", "all", load)).rejects.toThrow(
      "offline",
    );
    await cache.cachedRead("positions", "all", load);
    await vi.advanceTimersByTimeAsync(60_001);
    await cache.cachedRead("positions", "all", load);
    expect(load).toHaveBeenCalledTimes(3);
    for (let i = 0; i < 300; i++)
      await cache.cachedRead("positions", String(i), load);
    expect(cache.readCacheSnapshot().entries).toBeLessThanOrEqual(256);
    const big = vi.fn(async () => "x".repeat(600_000));
    await cache.cachedRead("auditLogs", "big", big);
    await cache.cachedRead("auditLogs", "big", big);
    expect(big).toHaveBeenCalledTimes(2);
    expect(cache.readCacheSnapshot().bytes).toBeLessThanOrEqual(
      cache.readCacheSnapshot().maxBytes,
    );
  });
});
