import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readChanges,
  startLiveUpdates,
} from "../../frontend/src/services/live-updates";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Live update stream", () => {
  it("honors quota cooldowns without triggering additional business reads", async () => {
    vi.useFakeTimers();
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response("", { status: 503, headers: { "Retry-After": "60" } }),
      );
    vi.stubGlobal("fetch", fetcher);
    const onChange = vi.fn();
    const stop = startLiveUpdates({
      url: "/api/v1/events",
      token: async () => "test",
      onChange,
      onConnection: vi.fn(),
    });
    await vi.advanceTimersByTimeAsync(59000);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetcher).toHaveBeenCalledTimes(2);
    stop();
  });

  it("does not refetch unchanged versions on reconnect and backs off streaming failures", async () => {
    vi.useFakeTimers();
    const fetcher = vi
      .fn()
      .mockImplementation(
        async () =>
          new Response(
            'event: changed\ndata: {"version":"same-commit"}\n\nevent: unavailable\ndata: {"retryAfterSeconds":60}\n\n',
            { headers: { "Content-Type": "text/event-stream" } },
          ),
      );
    vi.stubGlobal("fetch", fetcher);
    const onChange = vi.fn();
    const stop = startLiveUpdates({
      url: "/api/v1/events",
      token: async () => "test",
      onChange,
      onConnection: vi.fn(),
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(onChange).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(59000);
    expect(fetcher).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenCalledOnce();
    stop();
  });
  it("handles fragmented events and heartbeats without treating comments as changes", async () => {
    const chunks = [
      ": keepalive\r\n\r\n",
      "event: cha",
      'nged\r\ndata: {"version":"1"}\r',
      "\n\r\n",
      "event: revalidate\ndata: {}\n\n",
    ];
    const onChange = vi.fn();
    await readChanges(
      new ReadableStream({
        start(controller) {
          for (const chunk of chunks)
            controller.enqueue(new TextEncoder().encode(chunk));
          controller.close();
        },
      }),
      onChange,
    );
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("reconnects with a current token after failure and stops on cleanup", async () => {
    vi.useFakeTimers();
    const token = vi
      .fn()
      .mockResolvedValueOnce("first-token")
      .mockResolvedValue("new-token");
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response("", { status: 503 }));
    vi.stubGlobal("fetch", fetcher);
    const stop = startLiveUpdates({
      url: "/api/v1/events",
      token,
      onChange: vi.fn(),
      onConnection: vi.fn(),
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][1].headers.Authorization).toBe(
      "Bearer new-token",
    );
    stop();
    await vi.advanceTimersByTimeAsync(60000);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("revalidates permissions on a denied stream without exposing credentials", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 403 })),
    );
    const onChange = vi.fn();
    const stop = startLiveUpdates({
      url: "/api/v1/events",
      token: async () => "test",
      onChange,
      onConnection: vi.fn(),
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(onChange).toHaveBeenCalledOnce();
    stop();
  });
});
