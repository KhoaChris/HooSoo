import { randomUUID } from "node:crypto";
import type {
  PresenceMode,
  PresencePacket,
  PublicPresence,
  PresenceEntry,
} from "@hoosoo/shared";

type Session = {
  uid: string;
  employeeId: string;
  send: (packet: PresencePacket) => void;
  close: () => void;
  deadline: number;
};
// Ephemeral connection state belongs to this API process, never to Firestore.
export class PresenceHub {
  private sessions = new Map<string, Session>();
  private modes = new Map<string, PresenceMode>();
  constructor(
    private now = Date.now,
    readonly leaseMs = 90_000,
  ) {}
  private status(employeeId: string): PublicPresence {
    const sessions = [...this.sessions.values()].filter(
      (s) => s.employeeId === employeeId,
    );
    if (sessions.some((s) => this.modes.get(s.uid) === "online"))
      return "online";
    if (sessions.some((s) => this.modes.get(s.uid) === "dnd")) return "dnd";
    return "offline";
  }
  private entries(): PresenceEntry[] {
    return [...new Set([...this.sessions.values()].map((s) => s.employeeId))]
      .map((employeeId) => ({ employeeId, status: this.status(employeeId) }))
      .filter((e) => e.status !== "offline");
  }
  private broadcast(employeeId: string, before: PublicPresence) {
    const status = this.status(employeeId);
    if (status !== before)
      for (const s of this.sessions.values())
        s.send({ kind: "update", entries: [{ employeeId, status }] });
  }
  connect(
    uid: string,
    employeeId: string,
    preference: PresenceMode,
    send: Session["send"],
    close: () => void,
  ) {
    this.sweep();
    const before = this.status(employeeId),
      id = randomUUID();
    if (!this.modes.has(uid)) this.modes.set(uid, preference);
    this.sessions.set(id, {
      uid,
      employeeId,
      send,
      close,
      deadline: this.now() + this.leaseMs,
    });
    send({
      kind: "ready",
      connectionId: id,
      mode: this.modes.get(uid)!,
      entries: this.entries(),
    });
    this.broadcast(employeeId, before);
    return id;
  }
  heartbeat(uid: string, id: string) {
    const s = this.sessions.get(id);
    if (!s || s.uid !== uid) return false;
    if (s.deadline <= this.now()) {
      this.disconnect(uid, id);
      return false;
    }
    s.deadline = this.now() + this.leaseMs;
    return true;
  }
  disconnect(uid: string, id: string) {
    const s = this.sessions.get(id);
    if (!s || s.uid !== uid) return false;
    const before = this.status(s.employeeId);
    this.sessions.delete(id);
    if (![...this.sessions.values()].some((v) => v.uid === uid))
      this.modes.delete(uid);
    this.broadcast(s.employeeId, before);
    s.close();
    return true;
  }
  setMode(uid: string, mode: PresenceMode) {
    const own = [...this.sessions.values()].filter((s) => s.uid === uid);
    const ids = [...new Set(own.map((s) => s.employeeId))];
    const before = new Map(ids.map((id) => [id, this.status(id)]));
    if (own.length) this.modes.set(uid, mode);
    own.forEach((s) => s.send({ kind: "self", mode }));
    ids.forEach((id) => this.broadcast(id, before.get(id)!));
  }
  sweep() {
    for (const [id, s] of this.sessions)
      if (s.deadline <= this.now()) this.disconnect(s.uid, id);
  }
  closeAll() {
    for (const [id, s] of this.sessions) this.disconnect(s.uid, id);
  }
}
export const presenceHub = new PresenceHub();
// Existing SSE keepalive calls sweep; no background database queries.
