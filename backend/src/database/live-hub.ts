import { organization, tables } from "./store";
import {
  isFirestoreQuotaError,
  quotaError,
  QUOTA_RETRY_SECONDS,
} from "./firestore-operation";
import { recordUsage, requestUsage } from "../observability/firestore-usage";
import type { Table } from "@hoosoo/shared";
import { invalidateReadCache, setReadCacheLive } from "./read-cache";

type Change = { version: string; collections: Table[] | null };
type Subscriber = { change: (change: Change) => void; error: () => void };
const clients = new Set<Subscriber>();
let unsubscribe: (() => void) | undefined;
let last: Change | undefined;
let versions: Record<string, number> | undefined;
let retryAt = 0;
export function assertLiveAvailable() {
  if (Date.now() < retryAt) throw quotaError();
}

// One Firestore listener per API process, independent of browser tab count.
export function subscribeChanges(client: Subscriber) {
  if (Date.now() < retryAt) {
    queueMicrotask(client.error);
    return () => {};
  }
  clients.add(client);
  if (last) client.change({ ...last, collections: null });
  if (!unsubscribe)
    requestUsage.exit(() => {
      unsubscribe = organization.onSnapshot(
        (snapshot) => {
          recordUsage("live-listener", { reads: 1 });
          retryAt = 0;
          const next = snapshot.get("collectionVersions") as
            Record<string, number> | undefined;
          const changed =
            versions && next
              ? tables.filter((k) => next[k] !== versions![k])
              : null;
          const version = snapshot.updateTime
            ? `${snapshot.updateTime.seconds}:${snapshot.updateTime.nanoseconds}`
            : "empty";
          if (last?.version === version) return;
          // Invalidate before notifying clients: their subsequent GET must not
          // receive the result from before this commit (including other servers).
          invalidateReadCache(changed?.length ? changed : null);
          setReadCacheLive(true);
          last = { version, collections: changed?.length ? changed : null };
          versions = next;
          for (const subscriber of clients) subscriber.change(last);
        },
        (error) => {
          // Listener resource limits must not disable foreground reads/writes
          // that Firestore may still accept. Back off this channel separately.
          if (isFirestoreQuotaError(error))
            retryAt = Date.now() + QUOTA_RETRY_SECONDS * 1000;
          for (const subscriber of [...clients]) subscriber.error();
          clients.clear();
          closeChanges();
        },
      );
    });
  return () => {
    clients.delete(client);
    if (!clients.size) closeChanges();
  };
}
function closeChanges() {
  setReadCacheLive(false);
  unsubscribe?.();
  unsubscribe = undefined;
  last = undefined;
  versions = undefined;
}
