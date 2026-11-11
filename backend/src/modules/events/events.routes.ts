import { Router } from "express";
import { ensureFirebaseCredentials } from "../../config/firebase-admin";
import { env } from "../../config/env";
import { readState, mergeState, timeout } from "../../database/store";
import { subscribeChanges, assertLiveAvailable } from "../../database/live-hub";
import { actorFor } from "../../common/authorization";
import { AppError } from "../../utils/errors";
import {
  firestoreOperation,
  QUOTA_RETRY_SECONDS,
} from "../../database/firestore-operation";

export const eventsRoutes = Router();
const connections = new Set<() => void>();
export function closeEventStreams() {
  for (const close of connections) close();
}

// Validate current access without loading every business collection for a signal.
async function checkAccess(uid: string) {
  const s = await readState(
    ["memberships"],
    { memberships: { ids: [uid] } },
    { fresh: true },
  );
  const m = s.memberships[uid];
  if (m?.active && m.employeeId)
    mergeState(
      s,
      await readState(
        ["employees"],
        { employees: { ids: [m.employeeId] } },
        { fresh: true },
      ),
    );
  actorFor(s, uid);
}

eventsRoutes.get("/events", async (_req, res) => {
  assertLiveAvailable();
  const uid = res.locals.uid as string;
  await firestoreOperation(() =>
    timeout(
      ensureFirebaseCredentials().then(() => checkAccess(uid)),
      env.DB_TIMEOUT_MS * 3,
    ),
  );
  if (res.destroyed) return;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-store, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  let closed = false;
  let pending = Promise.resolve();
  let sent = false;
  const send = (event: string, data: object) => {
    if (!closed && !res.destroyed)
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  const close = () => {
    if (closed) return;
    closed = true;
    connections.delete(close);
    unsubscribe();
    clearInterval(heartbeat);
    clearTimeout(expiry);
    res.end();
  };
  const heartbeat = setInterval(() => {
    if (!closed) res.write(": keepalive\n\n");
  }, 15000);
  // Reconnect with a fresh bearer token; never let the stream outlive its token.
  const remaining = Number(res.locals.tokenExpiresAt) - Date.now();
  const expiry = setTimeout(close, Math.max(1, Math.min(3300000, remaining)));
  connections.add(close);
  res.on("close", close);

  const unsubscribe = subscribeChanges({
    change: (change) => {
      pending = pending.then(async () => {
        if (closed) return;
        try {
          if (
            sent &&
            (!change.collections ||
              change.collections.some(
                (k) => k === "memberships" || k === "employees",
              ))
          )
            await firestoreOperation(() =>
              timeout(checkAccess(uid), env.DB_TIMEOUT_MS),
            );
          // Only an opaque version is sent. Actual records use role-scoped GETs.
          send("changed", change);
          sent = true;
        } catch (error) {
          if (error instanceof AppError && error.status === 403)
            send("revalidate", {});
          else send("unavailable", { retryAfterSeconds: QUOTA_RETRY_SECONDS });
          close();
        }
      });
    },
    error: () => {
      send("unavailable", { retryAfterSeconds: QUOTA_RETRY_SECONDS });
      close();
    },
  });
});
