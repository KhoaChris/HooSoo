import { describe, it, expect } from "vitest";
import type { ChatMessage } from "@hoosoo/shared";
import {
  appendSentMessage,
  groupMessages,
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

describe("Chat message grouping", () => {
  it("keeps system events separate from nearby messages by the same actor", () => {
    const first = message(1),
      event = {
        ...message(2),
        event: {
          type: "member_left" as const,
          employeeId: "employee",
          name: "An",
        },
      },
      last = message(3);
    expect(
      groupMessages([first, event, last]).map((group) => group.length),
    ).toEqual([1, 1, 1]);
  });
  const at = (
    sequence: number,
    minute: number,
    senderId = "employee",
  ): ChatMessage => ({
    ...message(sequence),
    senderId,
    sentAt: new Date(2026, 10, 14, 17, minute).toISOString(),
  });
  const ids = (items: ChatMessage[]) =>
    groupMessages(items).map((group) => group.map((item) => item.id));

  it("keeps consecutive bubbles together up to two minutes apart", () => {
    expect(ids([at(1, 30), at(2, 31), at(3, 33), at(4, 36)])).toEqual([
      ["1", "2", "3"],
      ["4"],
    ]);
    expect(ids([])).toEqual([]);
    expect(ids([at(1, 30), at(2, 30)])).toEqual([["1", "2"]]);
  });

  it("starts a fresh group when another person replies, including self", () => {
    expect(ids([at(1, 30), at(2, 30, "self"), at(3, 31), at(4, 31)])).toEqual([
      ["1"],
      ["2"],
      ["3", "4"],
    ]);
  });

  it("does not join messages across a local midnight or a gap in loaded history", () => {
    const late = {
      ...at(1, 30),
      sentAt: new Date(2026, 10, 14, 23, 59).toISOString(),
    };
    const early = {
      ...at(2, 30),
      sentAt: new Date(2026, 10, 15, 0, 0).toISOString(),
    };
    expect(ids([late, early])).toEqual([["1"], ["2"]]);
    expect(ids([at(1, 30), at(3, 31)])).toEqual([["1"], ["3"]]);
  });

  it("handles older-page merges and live messages without changing original records", () => {
    const older = [at(1, 30), at(2, 31)];
    const latest = [at(3, 32), at(4, 33)];
    const merged = mergeMessages(older, latest);
    const history = appendSentMessage(
      { items: merged, hasOlder: false },
      at(5, 34),
    )!;
    expect(ids(history.items)).toEqual([["1", "2", "3", "4", "5"]]);
    expect(older).toHaveLength(2);
    expect(latest).toHaveLength(2);
    expect(groupMessages(history.items)[0][0]).toBe(older[0]);
  });

  it("separates unrelated rooms, invalid times, reverse time, and gaps above two minutes", () => {
    const first = at(1, 30);
    for (const next of [
      { ...at(2, 31), roomId: "another-room" },
      { ...at(2, 31), sentAt: "invalid" },
      at(2, 29),
      {
        ...at(2, 32),
        sentAt: new Date(
          new Date(first.sentAt).getTime() + 120001,
        ).toISOString(),
      },
    ])
      expect(ids([first, next])).toEqual([["1"], ["2"]]);
  });
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
