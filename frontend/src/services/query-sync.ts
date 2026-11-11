import type { QueryClient } from "@tanstack/react-query";
import { queryAffected } from "@hoosoo/shared";

// Coalesce a mutation response and its live signal into one targeted refresh.
const pending = new WeakMap<
  QueryClient,
  {
    tables: Set<string> | null;
    timer: ReturnType<typeof setTimeout>;
    done: () => void;
    result: Promise<void>;
  }
>();
export function refreshQueries(
  client: QueryClient,
  changed: readonly string[] | null,
) {
  const existing = pending.get(client);
  if (existing) {
    if (changed === null) existing.tables = null;
    else if (existing.tables)
      for (const table of changed) existing.tables.add(table);
    return existing.result;
  }
  let done!: () => void;
  const result = new Promise<void>((resolve) => {
    done = resolve;
  });
  const item = {
    tables: changed === null ? null : new Set(changed),
    done,
    result,
    timer: setTimeout(() => {
      pending.delete(client);
      const affected = new Set(
        client.getQueryCache().findAll({
          predicate: (q) =>
            q.queryKey[0] === "api" &&
            typeof q.queryKey[1] === "string" &&
            queryAffected(
              q.queryKey[1],
              item.tables === null ? null : [...item.tables],
            ),
        }),
      );
      const filters = {
        predicate: (q: Parameters<typeof affected.has>[0]) => affected.has(q),
      };
      void (async () => {
        // A GET started before the commit must not overwrite the new cache.
        // Keep the old data on screen while replacing only the affected reads.
        await client.cancelQueries(filters, { silent: true });
        await client.invalidateQueries(filters, { cancelRefetch: false });
      })()
        .catch(() => {})
        .finally(done);
    }, 150),
  };
  pending.set(client, item);
  return result;
}
export function cancelRefresh(client: QueryClient) {
  const item = pending.get(client);
  if (item) {
    clearTimeout(item.timer);
    pending.delete(client);
    item.done();
  }
}
