import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
const token = vi.hoisted(() => vi.fn());
vi.mock("../src/config/firebase-admin", () => ({
  auth: { verifyIdToken: token },
}));
vi.mock("../src/database/store", () => ({
  timeout: (p: Promise<unknown>) => p,
}));
import { authenticate } from "../src/middleware/authenticate";
import { parseEnv } from "../src/config/env";
import { parseFrontendEnv } from "../../frontend/src/config/env";
beforeEach(() => vi.clearAllMocks());
const run = async (authorization?: string) => {
  const next = vi.fn(),
    res = { locals: {} };
  await authenticate(
    { headers: { authorization } } as Request,
    res as Response,
    next as NextFunction,
  );
  return { next, res };
};
describe("authentication boundaries", () => {
  it("requires a bearer token before accessing the account service", async () => {
    const { next } = await run();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
    expect(token).not.toHaveBeenCalled();
  });
  it("checks revocation and records token expiry", async () => {
    token.mockResolvedValue({ uid: "example", exp: 100 });
    const { next, res } = await run("Bearer private-test-token");
    expect(token).toHaveBeenCalledWith("private-test-token", true);
    expect(next).toHaveBeenCalledWith();
    expect(res.locals).toEqual({ uid: "example", tokenExpiresAt: 100000 });
  });
  it.each([
    "auth/id-token-revoked",
    "auth/user-disabled",
    "auth/id-token-expired",
  ])("rejects %s without leaking upstream detail", async (code) => {
    token.mockRejectedValue({ code, message: "private diagnostic" });
    const { next } = await run("Bearer private-test-token");
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 401, code: "INVALID_TOKEN" }),
    );
    expect(JSON.stringify(next.mock.calls)).not.toContain("private diagnostic");
  });
  it("reports an Auth outage separately from an invalid login", async () => {
    token.mockRejectedValue({ code: "app/network-error" });
    const { next } = await run("Bearer private-test-token");
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 503, code: "AUTH_UNAVAILABLE" }),
    );
  });
});
describe("production transport boundaries", () => {
  const backend = {
    NODE_ENV: "production",
    FIREBASE_MODE: "cloud",
    FIREBASE_PROJECT_ID: "example-project",
    CORS_ORIGINS: "https://app.example.test",
  };
  const frontend = {
    VITE_API_BASE_URL: "/api/v1",
    VITE_FIREBASE_MODE: "cloud",
    VITE_FIREBASE_API_KEY: "public-key",
    VITE_FIREBASE_AUTH_DOMAIN: "example.test",
    VITE_FIREBASE_PROJECT_ID: "example-project",
    VITE_FIREBASE_APP_ID: "public-app-id",
  };
  it("requires exact HTTPS origins in production", () => {
    expect(parseEnv(backend).CORS_ORIGINS).toBe(backend.CORS_ORIGINS);
    for (const CORS_ORIGINS of [
      "*",
      "http://app.example.test",
      "https://app.example.test/path",
      "https://app.example.test/",
    ])
      expect(() => parseEnv({ ...backend, CORS_ORIGINS })).toThrow();
    expect(
      parseEnv({
        ...backend,
        NODE_ENV: "development",
        CORS_ORIGINS: "http://127.0.0.1:5173",
      }),
    ).toBeTruthy();
  });
  it("rejects plaintext and protocol-relative production API URLs", () => {
    expect(parseFrontendEnv(frontend, true)).toBeTruthy();
    expect(
      parseFrontendEnv(
        { ...frontend, VITE_API_BASE_URL: "https://api.example.test/api/v1" },
        true,
      ),
    ).toBeTruthy();
    for (const VITE_API_BASE_URL of [
      "http://example.test",
      "//example.test",
      "javascript:alert(1)",
    ])
      expect(() =>
        parseFrontendEnv({ ...frontend, VITE_API_BASE_URL }, true),
      ).toThrow();
  });
});
