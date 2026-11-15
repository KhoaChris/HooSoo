import { useSyncExternalStore } from "react";
import type {
  PresenceMode,
  PresencePacket,
  PublicPresence,
} from "@hoosoo/shared";
type State = {
  connected: boolean;
  mode: PresenceMode;
  entries: Readonly<Record<string, PublicPresence>>;
};
const initial: State = { connected: false, mode: "online", entries: {} };
let state = initial;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());
export function resetPresence() {
  state = initial;
  emit();
}
export function disconnectPresence() {
  state = { ...state, connected: false, entries: {} };
  emit();
}
export function receivePresence(packet: PresencePacket) {
  if (packet.kind === "self") state = { ...state, mode: packet.mode };
  else {
    const entries = packet.kind === "ready" ? {} : { ...state.entries };
    for (const entry of packet.entries) {
      if (entry.status === "offline") delete entries[entry.employeeId];
      else entries[entry.employeeId] = entry.status;
    }
    state = {
      connected: packet.kind === "ready" || state.connected,
      mode: packet.kind === "ready" ? packet.mode : state.mode,
      entries,
    };
  }
  emit();
}
export function presenceStatus(employeeId?: string) {
  return !state.connected
    ? "unknown"
    : (employeeId && state.entries[employeeId]) || "offline";
}
export function presenceSnapshot() {
  return state;
}
export function usePresence() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    presenceSnapshot,
    presenceSnapshot,
  );
}
