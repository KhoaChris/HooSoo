import { describe, it, expect } from "vitest";
import type { ChatMessage } from "@hoosoo/shared";
import {
  appendSentMessage,
  mergeMessages,
} from "../src/pages/chat/chat-history";
const message = (sequence: number): ChatMessage => ({
  id: String(sequence),
  roomId: "room",
  sequence,
  senderId: "employee",
  text: "Message " + sequence,
  sentAt: "2026-11-12T12:00:00Z",
});
describe("Chat history cursor safety", () => {
  it("does not skip unread history if send finishes before the first page", () => {
    expect(appendSentMessage(undefined, message(2))).toBeUndefined();
    expect(
      appendSentMessage({ items: [], hasOlder: false }, message(2))?.items,
    ).toEqual([]);
  });
  it("keeps the old cursor when another sender committed first", () => {
    const previous = { items: [message(1)], hasOlder: false };
    expect(appendSentMessage(previous, message(3))).toBe(previous);
    expect(
      appendSentMessage(previous, message(2))?.items.map((m) => m.sequence),
    ).toEqual([1, 2]);
  });
  it("merges delayed responses and older pages without duplicate messages", () => {
    expect(
      mergeMessages([message(3), message(4)], [message(2), message(3)]).map(
        (m) => m.sequence,
      ),
    ).toEqual([2, 3, 4]);
  });
});
