import { t } from "../../i18n";
import { mergeMessages, type MessageHistory } from "./chat-history";
export { mergeMessages, type MessageHistory } from "./chat-history";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChatMessagePage, ChatPerson, ChatRoom } from "@hoosoo/shared";
import { api } from "../../services/api-client";
import { apiQueryOptions } from "../../services/query-cache";
import { useAuth } from "../../app/auth";
export const roomName = (room: ChatRoom, people: ChatPerson[], self: string) =>
  room.kind === "group"
    ? room.title
    : people.find((p) => p.id === room.memberIds.find((id) => id !== self))
        ?.name || t("Đồng nghiệp");
export function useMessages(roomId: string) {
  const { user } = useAuth(),
    client = useQueryClient();
  const path = `/chat/rooms/${roomId}/messages`;
  const options = apiQueryOptions<MessageHistory>(
    path,
    user?.uid ?? null,
    () => {
      throw new Error("Custom incremental query");
    },
  );
  const query = useQuery({
    ...options,
    enabled: !!user && !!roomId,
    retry: false,
    queryFn: async ({ signal }) => {
      const previous = client.getQueryData<MessageHistory>(options.queryKey);
      let items = previous?.items ?? [],
        more = false;
      for (let page = 0; page < 2; page++) {
        const cursor = items.at(-1)?.sequence;
        const result = await api<ChatMessagePage>(
          path + (cursor ? `?after=${cursor}` : ""),
          { signal },
        );
        items = mergeMessages(items, result.items);
        if (cursor === undefined) return { items, hasOlder: result.hasMore };
        more = result.hasMore;
        if (!more) {
          const current = client.getQueryData<MessageHistory>(options.queryKey);
          return {
            items: mergeMessages(current?.items ?? [], items),
            hasOlder: current?.hasOlder ?? previous?.hasOlder ?? false,
          };
        }
      }
      // A long disconnection opens the latest page instead of downloading an
      // unbounded backlog. Earlier messages remain available via explicit paging.
      const latest = await api<ChatMessagePage>(path, { signal });
      return { items: latest.items, hasOlder: latest.hasMore };
    },
  });
  return { ...query, key: options.queryKey, path };
}
