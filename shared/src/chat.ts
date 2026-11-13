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
export interface ChatRoom extends Meta {
  kind: "direct" | "group";
  title: string;
  memberIds: string[];
  ownerId: string;
  version: number;
  sequence: number;
  lastMessage: { text: string; senderId: string; sentAt: string } | null;
}
export interface ChatMessage extends Meta {
  roomId: string;
  sequence: number;
  senderId: string;
  text: string;
  sentAt: string;
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
