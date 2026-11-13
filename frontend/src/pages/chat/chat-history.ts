import type { ChatMessage } from "@hoosoo/shared";
export type MessageHistory = { items: ChatMessage[]; hasOlder: boolean };
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
