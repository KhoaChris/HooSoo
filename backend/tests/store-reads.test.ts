import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn(), collection: vi.fn() }));
vi.mock("../src/config/firebase-admin", () => ({
  ensureFirebaseCredentials: async () => {},
  db: { collection: () => ({ doc: () => ({ collection: mocks.collection }) }) },
}));
beforeEach(() => {
  vi.resetModules();
  mocks.get.mockReset();
  mocks.collection.mockReset().mockImplementation((table: string) => ({
    limit: () => ({ get: () => mocks.get(table) }),
  }));
});
const snapshot = {
  size: 1,
  docs: [
    {
      id: "new-department",
      data: () => ({ name: "Customer Care", active: true }),
    },
  ],
};

describe("Scoped Firestore reads", () => {
  it("reads only requested collections and coalesces overlapping reads without caching completed data", async () => {
    const { readState } = await import("../src/database/store");
    let resolve!: (value: typeof snapshot) => void;
    mocks.get
      .mockReturnValueOnce(
        new Promise<typeof snapshot>((done) => {
          resolve = done;
        }),
      )
      .mockResolvedValue(snapshot);
    const first = readState(["departments"]);
    const second = readState(["departments", "departments"]);
    await vi.waitFor(() => expect(mocks.get).toHaveBeenCalledOnce());
    resolve(snapshot);
    const [a, b] = await Promise.all([first, second]);
    expect(mocks.collection).toHaveBeenCalledWith("departments");
    expect(a.auditLogs).toEqual({});
    expect(a.receipts).toEqual({});
    a.departments["new-department"].name = "Do not share mutable state";
    expect(b.departments["new-department"].name).toBe("Customer Care");
    await readState(["departments"]);
    expect(mocks.get).toHaveBeenCalledTimes(2);
  });

  it("does not retain failed in-flight reads", async () => {
    const { readState } = await import("../src/database/store");
    mocks.get.mockRejectedValueOnce({ code: 14 }).mockResolvedValue(snapshot);
    await expect(readState(["departments"])).rejects.toMatchObject({
      code: 14,
    });
    await expect(readState(["departments"])).resolves.toMatchObject({
      departments: { "new-department": { name: "Customer Care" } },
    });
    expect(mocks.get).toHaveBeenCalledTimes(2);
  });
});
