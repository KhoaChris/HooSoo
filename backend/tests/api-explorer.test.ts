import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Router } from "express";
import { createCatalog } from "../src/modules/api-explorer/catalog";

// Fail locally if the explorer reaches Firebase. No emulator or cloud needed.
const firebase = vi.hoisted(() => ({
  access: vi.fn(() => {
    throw new Error("Unexpected Firebase access");
  }),
  token: vi.fn(() => {
    throw new Error("Unexpected Auth access");
  }),
}));
vi.mock("../src/config/firebase-admin", () => ({
  auth: { verifyIdToken: firebase.token },
  db: {
    collection: () => ({
      doc: () => ({
        get: firebase.access,
        collection: firebase.access,
        onSnapshot: firebase.access,
      }),
    }),
    getAll: firebase.access,
    runTransaction: firebase.access,
  },
  ensureFirebaseCredentials: firebase.access,
}));
import { app } from "../src/app";
import { api, apiRouteGroups } from "../src/routes/index";
import * as store from "../src/database/store";

let server: Server;
let origin: string;
beforeAll(async () => {
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(
  () =>
    new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }),
);
beforeEach(() => {
  vi.clearAllMocks();
});

describe("API explorer", () => {
  it("serves the root, catalog and assets without reaching Firebase or Auth", async () => {
    const root = await fetch(origin);
    expect(root.status).toBe(200);
    expect(root.headers.get("content-type")).toContain("text/html");
    expect(root.headers.get("cache-control")).toBe("no-store");
    expect(root.headers.get("content-security-policy")).toContain(
      "script-src 'self'",
    );
    expect(root.headers.get("content-security-policy")).not.toContain(
      "upgrade-insecure-requests",
    );
    const html = await root.text();
    expect(html).toContain("HooSoo · API Explorer");
    expect(html).not.toMatch(/<script(?![^>]*src=)[^>]*>/);
    for (const [path, type] of [
      ["styles.css", "text/css"],
      ["app.js", "javascript"],
      ["catalog.json", "application/json"],
    ]) {
      const response = await fetch(`${origin}/api-explorer/${path}`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(type);
      await response.text();
    }
    expect(firebase.access).not.toHaveBeenCalled();
    expect(firebase.token).not.toHaveBeenCalled();
  });

  it("lists every registered business route once with its exact method and path", async () => {
    const response = await fetch(`${origin}/api-explorer/catalog.json`);
    const catalog = (await response.json()) as ReturnType<typeof createCatalog>;
    // Flatten the real mounted Express router, independently of the catalog registry.
    const expected = api.stack
      .flatMap((layer) =>
        (
          layer.handle as unknown as {
            stack: {
              route?: { path: string; methods: Record<string, boolean> };
            }[];
          }
        ).stack.flatMap(
          (child: {
            route?: { path: string; methods: Record<string, boolean> };
          }) =>
            child.route
              ? Object.keys(child.route.methods).map(
                  (method) =>
                    `${method.toUpperCase()} /api/v1${child.route!.path}`,
                )
              : [],
        ),
      )
      .sort();
    const actual = catalog.routes
      .filter((route) => route.group !== "system")
      .map((route) => route.id)
      .sort();
    expect(actual).toEqual(expected);
    expect(new Set(catalog.routes.map((route) => route.id)).size).toBe(
      catalog.routes.length,
    );
    expect(catalog.groups.reduce((sum, group) => sum + group.count, 0)).toBe(
      catalog.routes.length,
    );
    expect(
      catalog.routes
        .filter((route) => route.testable)
        .every((route) => route.method === "GET" && route.effect !== "stream"),
    ).toBe(true);
    expect(
      catalog.routes.find((route) => route.path === "/api/v1/events"),
    ).toMatchObject({ testable: false, effect: "stream" });
    expect(
      catalog.routes
        .filter((route) => route.effect === "write")
        .every((route) => route.idempotency && !route.testable),
    ).toBe(true);
    expect(firebase.access).not.toHaveBeenCalled();
  });

  it("reflects newly registered routes without executing any handlers", () => {
    const router = Router();
    const handler = vi.fn((_req, res) => res.end());
    router.get("/example/:id", handler);
    router.patch("/example/:id", handler);
    const catalog = createCatalog([{ id: "example", name: "Example", router }]);
    expect(
      catalog.routes
        .filter((route) => route.group === "example")
        .map((route) => route.id),
    ).toEqual(["GET /api/v1/example/:id", "PATCH /api/v1/example/:id"]);
    expect(handler).not.toHaveBeenCalled();
  });

  it("keeps API authentication and unknown-route errors in place", async () => {
    const response = await fetch(`${origin}/api/v1/employees`);
    expect(response.status).toBe(401);
    await response.text();
    const unknown = await fetch(`${origin}/api/not-a-route`);
    expect(unknown.status).toBe(404);
    expect(unknown.headers.get("content-type")).toContain("application/json");
    await unknown.text();
    expect(firebase.access).not.toHaveBeenCalled();
    expect(firebase.token).not.toHaveBeenCalled();
  });

  it("keeps health free of reads; readiness is invoked only by its explicit request", async () => {
    const readiness = vi.spyOn(store, "readiness").mockResolvedValue({
      status: "ok",
      checkedAt: new Date().toISOString(),
      latencyMs: 1,
      mode: "emulator",
    } as Awaited<ReturnType<typeof store.readiness>>);
    try {
      for (const path of ["/", "/api-explorer/catalog.json", "/api/health"]) {
        const response = await fetch(origin + path);
        expect(response.status).toBe(200);
        await response.text();
      }
      expect(readiness).not.toHaveBeenCalled();
      expect(firebase.access).not.toHaveBeenCalled();
      const response = await fetch(`${origin}/api/ready`);
      expect(response.status).toBe(200);
      await response.text();
      expect(readiness).toHaveBeenCalledTimes(1);
    } finally {
      readiness.mockRestore();
    }
  });

  it("does not include configuration secrets in public metadata", () => {
    const serialized = JSON.stringify(createCatalog(apiRouteGroups));
    for (const key of [
      "private_key",
      "client_email",
      "GOOGLE_APPLICATION_CREDENTIALS",
      "FIREBASE_API_KEY",
    ])
      expect(serialized).not.toContain(key);
  });
});
