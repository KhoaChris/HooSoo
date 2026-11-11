import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("Firestore quota handling", () => {
  it("stops repeated upstream calls after quota exhaustion and probes after cooldown", async () => {
    const { firestoreOperation } =
      await import("../src/database/firestore-operation");
    const operation = vi
      .fn()
      .mockRejectedValueOnce({ code: 8 })
      .mockResolvedValue("fresh cloud data");
    await expect(firestoreOperation(operation)).rejects.toMatchObject({
      status: 503,
      code: "FIRESTORE_QUOTA_EXCEEDED",
    });
    await expect(firestoreOperation(operation)).rejects.toMatchObject({
      code: "FIRESTORE_QUOTA_EXCEEDED",
    });
    expect(operation).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(60000);
    await expect(firestoreOperation(operation)).resolves.toBe(
      "fresh cloud data",
    );
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("keeps other failures distinct and records streaming quota failures", async () => {
    const { firestoreOperation, recordFirestoreFailure } =
      await import("../src/database/firestore-operation");
    const error = { code: 14 };
    await expect(
      firestoreOperation(async () => {
        throw error;
      }),
    ).rejects.toBe(error);
    await expect(firestoreOperation(async () => "healthy")).resolves.toBe(
      "healthy",
    );
    recordFirestoreFailure({ code: 8 });
    const operation = vi.fn();
    await expect(firestoreOperation(operation)).rejects.toMatchObject({
      code: "FIRESTORE_QUOTA_EXCEEDED",
    });
    expect(operation).not.toHaveBeenCalled();
  });
});
