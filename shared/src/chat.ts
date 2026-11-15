import { z } from "zod";
import type { Meta } from "./index";
const memberId = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
export const chatCreateSchema = z
  .object({
    kind: z.enum(["direct", "group"]),
    title: z.string().trim().max(80).default(""),
    memberIds: z.array(memberId).min(1).max(29),
  })
  .strict();
export const chatGroupSchema = z
  .object({
    title: z.string().trim().min(1).max(80),
    memberIds: z.array(memberId).min(2).max(30),
    ownerId: memberId,
    version: z.number().int().positive(),
  })
  .strict();
export const chatMessageSchema = z
  .object({ text: z.string().trim().min(1).max(4000) })
  .strict();
export const chatLifecycleSchema = z
  .object({
    action: z.enum(["archive", "restore", "leave", "dissolve", "hide"]),
    version: z.number().int().positive(),
    preferenceVersion: z.number().int().min(0).default(0),
  })
  .strict();
export type ChatLifecycleInput = z.infer<typeof chatLifecycleSchema>;
export interface ChatSystemEvent {
  type: "member_left" | "group_dissolved";
  employeeId: string;
  name: string;
}
export interface ChatMemberState {
  version: number;
  archivedThrough?: number;
  hidden?: boolean;
}
export interface ChatRoom extends Meta {
  kind: "direct" | "group";
  title: string;
  memberIds: string[];
  ownerId: string;
  version: number;
  sequence: number;
  lastMessage: {
    text: string;
    senderId: string;
    sentAt: string;
    event?: ChatSystemEvent;
  } | null;
  dissolved?: { byId: string; byName: string; at: string };
  memberState?: Record<string, ChatMemberState>;
}
export type ChatRoomView = Omit<ChatRoom, "memberState"> & {
  viewer: { archived: boolean; hidden: boolean; version: number };
};
export function chatViewer(
  room: ChatRoom,
  employeeId: string,
): ChatRoomView["viewer"] {
  const state = room.memberState?.[employeeId];
  return {
    hidden: state?.hidden ?? false,
    archived:
      state?.archivedThrough !== undefined &&
      room.sequence <= state.archivedThrough,
    version: state?.version ?? 0,
  };
}
/** Personal mailbox changes wake only that member's sessions. */
export function chatChangedMembers(
  before: ChatRoom | undefined,
  after: ChatRoom,
): string[] {
  const { memberState: previous, ...oldPublic } = before ?? {};
  const { memberState: current, ...newPublic } = after;
  if (JSON.stringify(oldPublic) !== JSON.stringify(newPublic))
    return [...new Set([...(before?.memberIds ?? []), ...after.memberIds])];
  return after.memberIds.filter(
    (id) => JSON.stringify(previous?.[id]) !== JSON.stringify(current?.[id]),
  );
}
export interface ChatMessage extends Meta {
  roomId: string;
  sequence: number;
  senderId: string;
  text: string;
  sentAt: string;
  event?: ChatSystemEvent;
}
export interface ChatPerson {
  id: string;
  name: string;
  avatarUrl: string | null;
  departmentId: string;
}
export interface ChatMessagePage {
  items: ChatMessage[];
  hasMore: boolean;
}
