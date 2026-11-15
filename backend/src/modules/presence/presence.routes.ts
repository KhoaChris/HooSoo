import { Router } from "express";
import {
  presencePreferenceSchema,
  presenceSessionSchema,
} from "@hoosoo/shared";
import { validate } from "../../middleware/validate";
import { context } from "../../routes/helpers";
import { assert } from "../../utils/errors";
import { presenceHub } from "./presence-hub";
import { savePresencePreference } from "./presence.repository";
export const presenceRoutes = Router();
const writes = new Map<string, Promise<unknown>>();
presenceRoutes.patch("/me/presence", async (req, res) => {
  const { mode } = validate(presencePreferenceSchema, req.body);
  const uid = res.locals.uid as string;
  // Serialize an account's choices so concurrent tabs cannot publish stale state.
  const previous = writes.get(uid) ?? Promise.resolve();
  const operation = previous
    .catch(() => {})
    .then(async () => {
      await context(res, [], true);
      await savePresencePreference(uid, mode);
      presenceHub.setMode(uid, mode);
    });
  writes.set(uid, operation);
  try {
    await operation;
    res.json({ mode });
  } finally {
    if (writes.get(uid) === operation) writes.delete(uid);
  }
});
presenceRoutes.post("/presence/heartbeat", (req, res) => {
  const { connectionId } = validate(presenceSessionSchema, req.body);
  assert(
    presenceHub.heartbeat(res.locals.uid, connectionId),
    409,
    "PRESENCE_EXPIRED",
    "Kết nối hoạt động đã hết hạn.",
  );
  res.json({ ok: true });
});
presenceRoutes.post("/presence/disconnect", (req, res) => {
  const { connectionId } = validate(presenceSessionSchema, req.body);
  // Bound to the authenticated UID, idempotent and unable to close another user.
  presenceHub.disconnect(res.locals.uid, connectionId);
  res.json({ ok: true });
});
