import { randomUUID } from "node:crypto";
import type { Actor, State } from "@hoosoo/shared";

export function audit(
  s: State,
  a: Actor,
  action: string,
  targetId: string,
  changes: Record<string, unknown> = {},
  reason = "",
) {
  const id = randomUUID();
  s.auditLogs[id] = {
    id,
    actorId: a.uid,
    action,
    targetId,
    changes,
    reason,
    createdAt: new Date().toISOString(),
  };
}
