import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
const mocks = vi.hoisted(() => ({
  allowed: new Set(["admin", "hr", "manager", "employee"]),
  context: vi.fn(),
  save: vi.fn(),
}));
vi.mock("../src/routes/helpers", () => ({
  context: async (res: { locals: { uid: string } }) => {
    mocks.context(res.locals.uid);
    if (!mocks.allowed.has(res.locals.uid))
      throw Object.assign(new Error("Access disabled"), { status: 403 });
    return {};
  },
}));
vi.mock("../src/modules/presence/presence.repository", () => ({
  savePresencePreference: mocks.save,
}));
import { presenceRoutes } from "../src/modules/presence/presence.routes";
import { presenceHub } from "../src/modules/presence/presence-hub";
let server: Server, base: string;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const uid = req.header("Authorization")?.replace("Bearer ", "");
    if (!uid) {
      res.sendStatus(401);
      return;
    }
    res.locals.uid = uid;
    next();
  });
  app.use(presenceRoutes);
  app.use(
    (
      err: { status?: number },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => res.status(err.status ?? 400).json({ error: true }),
  );
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.on("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  presenceHub.closeAll();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
beforeEach(() => {
  presenceHub.closeAll();
  mocks.context.mockClear();
  mocks.save.mockReset();
  mocks.save.mockResolvedValue(undefined);
  mocks.allowed.add("employee");
});
const request = (path: string, uid: string, body: unknown, method = "POST") =>
  fetch(base + path, {
    method,
    headers: {
      Authorization: `Bearer ${uid}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
describe("Presence HTTP API", () => {
  it("persists only the authenticated account preference and syncs existing sessions", async () => {
    const send = vi.fn();
    presenceHub.connect("employee", "e", "online", send, () => {});
    expect(
      (
        await request(
          "/me/presence",
          "employee",
          { mode: "invisible" },
          "PATCH",
        )
      ).status,
    ).toBe(200);
    expect(mocks.save).toHaveBeenCalledExactlyOnceWith("employee", "invisible");
    expect(send).toHaveBeenCalledWith({ kind: "self", mode: "invisible" });
    expect(
      (
        await request(
          "/me/presence",
          "employee",
          { mode: "dnd", uid: "admin" },
          "PATCH",
        )
      ).status,
    ).toBe(400);
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });
  it("heartbeat and logout do not read or write Firestore and cannot target another account", async () => {
    const close = vi.fn(),
      id = presenceHub.connect("employee", "e", "online", () => {}, close);
    expect(
      (await request("/presence/heartbeat", "employee", { connectionId: id }))
        .status,
    ).toBe(200);
    expect(
      (await request("/presence/heartbeat", "hr", { connectionId: id })).status,
    ).toBe(409);
    await request("/presence/disconnect", "hr", { connectionId: id });
    expect(close).not.toHaveBeenCalled();
    await request("/presence/disconnect", "employee", { connectionId: id });
    expect(close).toHaveBeenCalledOnce();
    expect(mocks.context).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("rejects revoked access and does not broadcast a failed preference write", async () => {
    const send = vi.fn();
    presenceHub.connect("employee", "e", "online", send, () => {});
    send.mockClear();
    mocks.allowed.delete("employee");
    expect(
      (
        await request(
          "/me/presence",
          "employee",
          { mode: "invisible" },
          "PATCH",
        )
      ).status,
    ).toBe(403);
    expect(mocks.save).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    mocks.allowed.add("employee");
    mocks.save.mockRejectedValueOnce(new Error("write failed"));
    expect(
      (
        await request(
          "/me/presence",
          "employee",
          { mode: "invisible" },
          "PATCH",
        )
      ).status,
    ).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });
});
