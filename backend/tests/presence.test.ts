import { describe, it, expect, vi, afterEach } from "vitest";
import { PresenceHub } from "../src/modules/presence/presence-hub";
import {
  readChanges,
  startLiveUpdates,
} from "../../frontend/src/services/live-updates";
import {
  receivePresence,
  resetPresence,
  presenceSnapshot,
  presenceStatus,
  disconnectPresence,
} from "../../frontend/src/services/presence-state";
import type { PresencePacket } from "@hoosoo/shared";
const ids = ["admin", "hr", "manager", "employee"];
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  resetPresence();
});
describe("Account presence", () => {
  it("syncs four roles without business reads, masks invisible and shares mode across sessions", () => {
    const hub = new PresenceHub();
    const inbox = Object.fromEntries(
      ids.map((id) => [id, [] as PresencePacket[]]),
    );
    const sessions = Object.fromEntries(
      ids.map((id) => [
        id,
        hub.connect(
          id,
          id,
          "online",
          (p) => inbox[id].push(p),
          () => {},
        ),
      ]),
    );
    for (const id of ids)
      expect(inbox[id].some((p) => p.kind === "ready")).toBe(true);
    const second: PresencePacket[] = [];
    const extra = hub.connect(
      "employee",
      "employee",
      "online",
      (p) => second.push(p),
      () => {},
    );
    hub.setMode("employee", "dnd");
    expect(inbox.admin.at(-1)).toEqual({
      kind: "update",
      entries: [{ employeeId: "employee", status: "dnd" }],
    });
    expect(second.some((p) => p.kind === "self" && p.mode === "dnd")).toBe(
      true,
    );
    hub.setMode("employee", "invisible");
    expect(inbox.manager.at(-1)).toEqual({
      kind: "update",
      entries: [{ employeeId: "employee", status: "offline" }],
    });
    expect(JSON.stringify(inbox.admin)).not.toContain("invisible");
    const observer: PresencePacket[] = [];
    hub.connect(
      "other",
      "other",
      "online",
      (p) => observer.push(p),
      () => {},
    );
    const ready = observer[0];
    expect(
      ready.kind === "ready" &&
        ready.entries.some((e) => e.employeeId === "employee"),
    ).toBe(false);
    hub.disconnect("employee", extra);
    hub.disconnect("employee", sessions.employee);
    hub.closeAll();
  });
  it("keeps online until the last session closes, rejects cross-account heartbeat and disconnect", () => {
    const hub = new PresenceHub(),
      observed = vi.fn();
    hub.connect("watch", "watch", "online", observed, () => {});
    const close = vi.fn(),
      one = hub.connect("u", "e", "online", () => {}, close),
      two = hub.connect("u", "e", "online", () => {}, close);
    observed.mockClear();
    expect(hub.disconnect("attacker", one)).toBe(false);
    expect(hub.heartbeat("attacker", one)).toBe(false);
    hub.disconnect("u", one);
    expect(observed).not.toHaveBeenCalled();
    hub.disconnect("u", two);
    expect(observed).toHaveBeenLastCalledWith({
      kind: "update",
      entries: [{ employeeId: "e", status: "offline" }],
    });
    expect(close).toHaveBeenCalledTimes(2);
    hub.closeAll();
  });
  it("expires dead connections and rejects late pulses without resurrecting them", () => {
    let clock = 0;
    const hub = new PresenceHub(() => clock, 90_000),
      close = vi.fn(),
      packets = vi.fn();
    const observer = hub.connect(
      "observer",
      "observer",
      "online",
      packets,
      () => {},
    );
    const id = hub.connect("u", "e", "online", () => {}, close);
    clock = 80_000;
    expect(hub.heartbeat("observer", observer)).toBe(true);
    clock = 90_000;
    hub.sweep();
    expect(close).toHaveBeenCalledOnce();
    expect(hub.heartbeat("u", id)).toBe(false);
    expect(packets).toHaveBeenLastCalledWith({
      kind: "update",
      entries: [{ employeeId: "e", status: "offline" }],
    });
    hub.closeAll();
  });
  it("starts invisible without publishing a transient online event", () => {
    const hub = new PresenceHub(),
      observer = vi.fn(),
      self = vi.fn();
    hub.connect("o", "o", "online", observer, () => {});
    observer.mockClear();
    hub.connect("hidden", "hidden", "invisible", self, () => {});
    expect(observer).not.toHaveBeenCalled();
    expect(self.mock.calls[0][0].mode).toBe("invisible");
    hub.closeAll();
  });
  it("deduplicates unchanged status and pulses", () => {
    const hub = new PresenceHub(),
      observer = vi.fn();
    const id = hub.connect("u", "u", "online", observer, () => {});
    observer.mockClear();
    for (let n = 0; n < 120; n++) expect(hub.heartbeat("u", id)).toBe(true);
    expect(observer).not.toHaveBeenCalled();
    hub.setMode("u", "online");
    expect(observer.mock.calls.every(([p]) => p.kind === "self")).toBe(true);
    hub.closeAll();
  });
});
describe("Presence stream and local state", () => {
  it("does not invalidate queries for presence frames and validates payloads", async () => {
    const change = vi.fn(),
      presence = vi.fn();
    const chunks = [
      'event: presence\ndata: {"kind":"update","entries":[{"employeeId":"e","status":"online"}]}\n\n',
      'event: presence\ndata: {"kind":"update","entries":[{"employeeId":"e","status":"invisible"}]}\n\n',
      ": keepalive\n\n",
    ];
    await readChanges(
      new ReadableStream({
        start(c) {
          chunks.forEach((v) => c.enqueue(new TextEncoder().encode(v)));
          c.close();
        },
      }),
      change,
      () => {},
      presence,
    );
    expect(change).not.toHaveBeenCalled();
    expect(presence).toHaveBeenCalledOnce();
  });
  it("replaces reconnect snapshots, preserves private mode and clears on logout", () => {
    receivePresence({
      kind: "ready",
      connectionId: crypto.randomUUID(),
      mode: "invisible",
      entries: [{ employeeId: "e", status: "online" }],
    });
    expect(presenceStatus("e")).toBe("online");
    expect(presenceSnapshot().mode).toBe("invisible");
    receivePresence({
      kind: "update",
      entries: [{ employeeId: "e", status: "offline" }],
    });
    expect(presenceStatus("e")).toBe("offline");
    receivePresence({
      kind: "update",
      entries: [{ employeeId: "stale", status: "online" }],
    });
    receivePresence({
      kind: "ready",
      connectionId: crypto.randomUUID(),
      mode: "dnd",
      entries: [],
    });
    expect(presenceStatus("stale")).toBe("offline");
    disconnectPresence();
    expect(presenceStatus("e")).toBe("unknown");
    resetPresence();
    expect(presenceSnapshot().mode).toBe("online");
  });
  it("maintains the lease with authenticated memory-only endpoints and releases on logout", async () => {
    vi.useFakeTimers();
    const id = crypto.randomUUID(),
      change = vi.fn();
    let stream: ReadableStreamDefaultController<Uint8Array>;
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/events"))
        return new Response(
          new ReadableStream({
            start(c) {
              stream = c;
              c.enqueue(
                new TextEncoder().encode(
                  `event: presence\ndata: {"kind":"ready","connectionId":"${id}","mode":"online","entries":[]}\n\n`,
                ),
              );
              init?.signal?.addEventListener("abort", () => {
                try {
                  c.close();
                } catch {
                  /* closed */
                }
              });
            },
          }),
          { headers: { "Content-Type": "text/event-stream" } },
        );
      return new Response('{"ok":true}', {
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetcher);
    const stop = startLiveUpdates({
      url: "/api/v1/events",
      token: async () => "token",
      onChange: change,
      onConnection: vi.fn(),
      onPresence: vi.fn(),
    });
    await vi.advanceTimersByTimeAsync(0);
    stream!.enqueue(new TextEncoder().encode(": keepalive\n\n"));
    await vi.advanceTimersByTimeAsync(25_000);
    expect(
      fetcher.mock.calls.some(([url]) => url === "/api/v1/presence/heartbeat"),
    ).toBe(true);
    const pulse = fetcher.mock.calls.find(([url]) =>
      url.endsWith("heartbeat"),
    )![1]!;
    expect(JSON.parse(pulse.body as string)).toEqual({ connectionId: id });
    expect(pulse.headers).toMatchObject({ Authorization: "Bearer token" });
    expect(change).not.toHaveBeenCalled();
    stop();
    await vi.advanceTimersByTimeAsync(0);
    expect(
      fetcher.mock.calls.filter(([url]) => url.endsWith("disconnect")),
    ).toHaveLength(1);
    const count = fetcher.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetcher).toHaveBeenCalledTimes(count);
  });
});
