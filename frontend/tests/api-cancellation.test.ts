import { afterEach, describe, expect, it, vi } from "vitest";

const token = vi.hoisted(() => vi.fn());
vi.mock("../src/config/firebase", () => ({
  auth: { currentUser: { getIdToken: token } },
  env: { VITE_API_BASE_URL: "/api/v1" },
}));
import { api } from "../src/services/api-client";
afterEach(() => {
  vi.unstubAllGlobals();
  token.mockReset();
});

describe("Cancelled API reads", () => {
  it("does not issue a request after cancellation while waiting for a token", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    let resolve!: (value: string) => void;
    token.mockReturnValue(
      new Promise<string>((done) => {
        resolve = done;
      }),
    );
    const controller = new AbortController();
    const result = api("/departments", { signal: controller.signal });
    const failed = expect(result).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });
    controller.abort();
    resolve("fixture-token");
    await failed;
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("honors an already-aborted signal before starting fetch", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    token.mockResolvedValue("fixture-token");
    const controller = new AbortController();
    controller.abort();
    await expect(
      api("/employees", { signal: controller.signal }),
    ).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
