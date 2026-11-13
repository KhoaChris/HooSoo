import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  get: vi.fn(),
  collection: vi.fn(),
}));
vi.mock("../src/database/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/database/store")>()),
  organization: { collection: mock.collection },
}));
vi.mock("../src/config/firebase-admin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/config/firebase-admin")>()),
  ensureFirebaseCredentials: async () => {},
}));
import { readMessages } from "../src/modules/chat/chat.repository";
import {
  invalidateReadCache,
  setReadCacheLive,
} from "../src/database/read-cache";
import { messageId } from "../src/modules/chat/chat.service";
beforeEach(() => {
  for (const fn of Object.values(mock)) fn.mockReset();
  const query = {
    where: mock.where,
    orderBy: mock.orderBy,
    limit: mock.limit,
    get: mock.get,
  };
  mock.collection.mockReturnValue(query);
  mock.where.mockReturnValue(query);
  mock.orderBy.mockReturnValue(query);
  mock.limit.mockReturnValue(query);
  mock.get.mockResolvedValue({
    size: 1,
    docs: [
      {
        id: messageId("room", 100),
        data: () => ({
          sequence: 100,
          roomId: "room",
          text: "new",
          senderId: "employee",
          sentAt: "2026-11-12T12:00:00Z",
        }),
      },
    ],
  });
  setReadCacheLive(false);
  setReadCacheLive(true);
});
describe("Bounded cloud chat queries", () => {
  it("uses the built-in ascending name index for the latest 40 sequences", async () => {
    await readMessages("room", 100);
    expect(mock.collection).toHaveBeenCalledWith("chatMessages");
    expect(mock.orderBy.mock.calls[0][1]).toBe("asc");
    expect(mock.where.mock.calls.map((c) => c.slice(1))).toEqual([
      [">=", messageId("room", 61)],
      ["<=", messageId("room", 100)],
    ]);
    expect(mock.limit).toHaveBeenCalledWith(40);
  });
  it("shares message pages across members and only queries the new range after invalidation", async () => {
    await Promise.all([
      readMessages("room", 100, 99),
      readMessages("room", 100, 99),
    ]);
    await readMessages("room", 100, 99);
    expect(mock.get).toHaveBeenCalledOnce();
    invalidateReadCache(["chatMessages"]);
    await readMessages("room", 101, 100);
    expect(mock.get).toHaveBeenCalledTimes(2);
    expect(mock.where.mock.calls.slice(-2).map((c) => c.slice(1))).toEqual([
      [">=", messageId("room", 101)],
      ["<=", messageId("room", 101)],
    ]);
  });
  it("returns an empty delta without reading Firestore and bounds older pages", async () => {
    expect(await readMessages("room", 100, 100)).toEqual({
      items: [],
      hasMore: false,
    });
    expect(mock.get).not.toHaveBeenCalled();
    await readMessages("room", 100, undefined, 61);
    expect(mock.where.mock.calls.map((c) => c.slice(1))).toEqual([
      [">=", messageId("room", 21)],
      ["<=", messageId("room", 60)],
    ]);
  });
});
