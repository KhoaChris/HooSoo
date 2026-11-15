import type { ChatMessage } from "@hoosoo/shared";
export type MessageHistory = { items: ChatMessage[]; hasOlder: boolean };

/** Group only adjacent, fully loaded messages; keep calendar day separators. */
export function groupMessages(
  messages: readonly ChatMessage[],
): ChatMessage[][] {
  const groups: ChatMessage[][] = [];
  for (const message of messages) {
    const group = groups.at(-1);
    const previous = group?.at(-1);
    const sentAt = new Date(message.sentAt);
    const previousAt = previous ? new Date(previous.sentAt) : null;
    const gap = previousAt ? sentAt.getTime() - previousAt.getTime() : NaN;
    if (
      group &&
      previous &&
      previousAt &&
      message.roomId === previous.roomId &&
      message.senderId === previous.senderId &&
      !message.event &&
      !previous.event &&
      message.sequence === previous.sequence + 1 &&
      gap >= 0 &&
      gap <= 2 * 60 * 1000 &&
      sentAt.toDateString() === previousAt.toDateString()
    ) {
      group.push(message);
    } else {
      groups.push([message]);
    }
  }
  return groups;
}

export const mergeMessages = (a: ChatMessage[], b: ChatMessage[]) =>
  [...new Map([...a, ...b].map((m) => [m.id, m])).values()].sort(
    (a, b) => a.sequence - b.sequence,
  );
export function appendSentMessage(
  history: MessageHistory | undefined,
  message: ChatMessage,
) {
  if (
    !history ||
    message.sequence !== (history.items.at(-1)?.sequence ?? 0) + 1
  )
    return history;
  return { ...history, items: mergeMessages(history.items, [message]) };
}
