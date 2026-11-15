import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { PresencePacket } from "@hoosoo/shared";
const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  preference: vi.fn(),
  listeners: new Set<{
    change: (v: { version: string; collections: string[] | null }) => void;
    error: () => void;
  }>(),
}));
vi.mock("../src/config/env", () => ({
  env: { DB_TIMEOUT_MS: 500 },
  ORG_ID: "hoosoo",
}));
vi.mock("../src/config/firebase-admin", () => ({
  ensureFirebaseCredentials: async () => {},
}));
vi.mock("../src/database/store", () => ({
  readState: mocks.read,
  mergeState: (a: object, b: object) => Object.assign(a, b),
  timeout: <T>(p: Promise<T>) => p,
}));
vi.mock("../src/database/live-hub", () => ({
  assertLiveAvailable: () => {},
  visibleCollections: (v: { collections: string[] | null }) => v.collections,
  subscribeChanges: (listener: {
    change: (v: { version: string; collections: string[] | null }) => void;
    error: () => void;
  }) => {
    mocks.listeners.add(listener);
    listener.change({ version: "initial", collections: null });
    return () => mocks.listeners.delete(listener);
  },
}));
vi.mock("../src/modules/presence/presence.repository", () => ({
  readPresencePreference: mocks.preference,
}));
import {
  eventsRoutes,
  closeEventStreams,
} from "../src/modules/events/events.routes";
import { presenceHub } from "../src/modules/presence/presence-hub";
let server: Server,
  base: string,
  enabled = true;
beforeAll(async () => {
  const app = express();
  app.use((req, res, next) => {
    res.locals.uid = req.header("Authorization")?.replace("Bearer ", "");
    res.locals.tokenExpiresAt = Date.now() + 3600000;
    next();
  });
  app.use(eventsRoutes);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.on("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  closeEventStreams();
  presenceHub.closeAll();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
beforeEach(() => {
  closeEventStreams();
  presenceHub.closeAll();
  enabled = true;
  mocks.preference.mockReset().mockResolvedValue("online");
  mocks.read
    .mockReset()
    .mockImplementation(
      async (
        keys: string[],
        plan: {
          memberships?: { ids: string[] };
          employees?: { ids: string[] };
        },
      ) =>
        keys[0] === "memberships"
          ? {
              memberships: {
                [plan.memberships!.ids[0]]: {
                  active: enabled,
                  orgId: "hoosoo",
                  role: "Employee",
                  employeeId: plan.memberships!.ids[0],
                },
              },
            }
          : {
              employees: {
                [plan.employees!.ids[0]]: {
                  id: plan.employees!.ids[0],
                  status: "active",
                },
              },
            },
    );
});
const open = async (uid: string) => {
  const response = await fetch(base + "/events", {
    headers: { Authorization: `Bearer ${uid}` },
  });
  expect(response.status).toBe(200);
  const reader = response.body!.getReader();
  const first = new TextDecoder().decode((await reader.read()).value);
  const line = first.split("\n").find((l) => l.startsWith("data:"))!;
  return { reader, ready: JSON.parse(line.slice(5)) as PresencePacket };
};
describe("Presence wiring on the actual event stream", () => {
  it("registers persisted invisible sessions without announcing online, and cleans up on socket close", async () => {
    const observer = vi.fn();
    presenceHub.connect("admin", "admin", "online", observer, () => {});
    observer.mockClear();
    mocks.preference.mockResolvedValueOnce("invisible");
    const { reader, ready } = await open("employee");
    expect(ready.kind).toBe("ready");
    expect(ready).toMatchObject({
      mode: "invisible",
      entries: [{ employeeId: "admin", status: "online" }],
    });
    expect(observer).not.toHaveBeenCalled();
    presenceHub.setMode("employee", "online");
    expect(observer).toHaveBeenLastCalledWith({
      kind: "update",
      entries: [{ employeeId: "employee", status: "online" }],
    });
    await reader.cancel();
    await vi.waitFor(() =>
      expect(observer).toHaveBeenLastCalledWith({
        kind: "update",
        entries: [{ employeeId: "employee", status: "offline" }],
      }),
    );
    expect(mocks.preference).toHaveBeenCalledExactlyOnceWith("employee");
    expect(mocks.read).toHaveBeenCalledTimes(2);
  });
  it("withdraws presence when current membership is revoked", async () => {
    const observer = vi.fn();
    presenceHub.connect("admin", "admin", "online", observer, () => {});
    const { reader } = await open("employee");
    await vi.waitFor(() => expect(mocks.listeners.size).toBe(1));
    enabled = false;
    mocks.listeners.forEach((l) =>
      l.change({ version: "revoked", collections: ["memberships"] }),
    );
    await vi.waitFor(() =>
      expect(observer).toHaveBeenLastCalledWith({
        kind: "update",
        entries: [{ employeeId: "employee", status: "offline" }],
      }),
    );
    expect(mocks.listeners.size).toBe(0);
    await reader.cancel();
  });
});
