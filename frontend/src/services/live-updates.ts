// The stream contains invalidation signals only. Business data still comes from
// the normal authenticated, role-scoped API after a Firestore commit.
export async function readChanges(
  body: ReadableStream<Uint8Array>,
  onChange: (version?: string, collections?: string[] | null) => void,
  onUnavailable: (retryAfterSeconds: number) => void = () => {},
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true }).replace(/\r/g, "");
      if (buffer.length > 65536) throw new Error("Invalid update stream");
      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const event = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const type = event
          .split("\n")
          .find((line) => line.startsWith("event:"))
          ?.slice(6)
          .trim();
        const data = event
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .join("\n");
        let payload: {
          version?: string;
          retryAfterSeconds?: number;
          collections?: string[] | null;
        } = {};
        try {
          const parsed = JSON.parse(data || "{}");
          if (parsed && typeof parsed === "object") payload = parsed;
        } catch {
          /* Ignore malformed data. */
        }
        if (type === "changed")
          onChange(
            typeof payload.version === "string" ? payload.version : undefined,
            Array.isArray(payload.collections) &&
              payload.collections.every((k) => typeof k === "string")
              ? payload.collections
              : null,
          );
        if (type === "revalidate") onChange();
        if (type === "unavailable")
          onUnavailable(
            typeof payload.retryAfterSeconds === "number" &&
              Number.isFinite(payload.retryAfterSeconds)
              ? payload.retryAfterSeconds
              : 60,
          );
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function startLiveUpdates(options: {
  url: string;
  token: () => Promise<string>;
  onChange: (collections: string[] | null) => void;
  onConnection: (connected: boolean) => void;
}) {
  options.onConnection(false);
  let stopped = false;
  let request: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let retryMs = 1000;
  let lastVersion: string | undefined;
  const connect = async () => {
    if (stopped) return;
    const controller = new AbortController();
    request = controller;
    let watchdog = setTimeout(() => controller.abort(), 45000);
    const touch = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => controller.abort(), 45000);
    };
    try {
      const token = await options.token();
      if (stopped) return;
      const response = await fetch(options.url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "text/event-stream",
        },
        signal: controller.signal,
        cache: "no-store",
      });
      if (
        !response.ok ||
        !response.body ||
        !response.headers.get("content-type")?.includes("text/event-stream")
      ) {
        if (response.status === 401 || response.status === 403)
          options.onChange(null);
        const retryAfter = Number(response.headers.get("retry-after"));
        if (Number.isFinite(retryAfter) && retryAfter > 0)
          retryMs = Math.max(retryMs, Math.min(retryAfter, 300) * 1000);
        throw new Error("Update stream unavailable");
      }
      if (stopped) return;
      retryMs = 1000;
      options.onConnection(true);
      // Heartbeats also reset the watchdog, even though they aren't changes.
      const stream = response.body.pipeThrough(
        new TransformStream({
          transform(chunk, output) {
            touch();
            output.enqueue(chunk);
          },
        }),
      );
      await readChanges(
        stream,
        (version, collections) => {
          if (stopped) return;
          if (version && version === lastVersion) return;
          lastVersion = version;
          options.onChange(collections || null);
        },
        (seconds) => {
          retryMs = Math.max(
            retryMs,
            Math.min(Math.max(seconds, 60), 300) * 1000,
          );
        },
      );
    } catch {
      // Retry quietly; normal API failures still appear in the relevant form.
    } finally {
      clearTimeout(watchdog);
      controller.abort();
      if (!stopped) {
        options.onConnection(false);
        timer = setTimeout(() => void connect(), retryMs);
        retryMs = Math.min(retryMs * 2, 30000);
      }
    }
  };
  void connect();
  return () => {
    stopped = true;
    clearTimeout(timer);
    request?.abort();
  };
}
