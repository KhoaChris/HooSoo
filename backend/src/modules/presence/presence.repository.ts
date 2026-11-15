import type { PresenceMode } from "@hoosoo/shared";
import { presenceModeSchema } from "@hoosoo/shared";
import { organization, timeout } from "../../database/store";
import { ensureFirebaseCredentials } from "../../config/firebase-admin";
import { firestoreOperation } from "../../database/firestore-operation";
import { recordUsage } from "../../observability/firestore-usage";
import { env } from "../../config/env";

// Private preferences are not part of business collections or their invalidations.
const ref = (uid: string) =>
  organization.collection("presencePreferences").doc(uid);
export function readPresencePreference(uid: string): Promise<PresenceMode> {
  return firestoreOperation(() =>
    timeout(
      (async () => {
        await ensureFirebaseCredentials();
        const doc = await ref(uid).get();
        recordUsage("presencePreferences", { reads: 1 });
        const result = presenceModeSchema.safeParse(doc.get("mode"));
        return result.success ? result.data : "online";
      })(),
      env.DB_TIMEOUT_MS,
    ),
  );
}
export function savePresencePreference(uid: string, mode: PresenceMode) {
  return firestoreOperation(() =>
    timeout(
      (async () => {
        await ensureFirebaseCredentials();
        await ref(uid).set({ mode }, { merge: true });
        recordUsage("presencePreferences", { writes: 1 });
      })(),
      env.DB_TIMEOUT_MS,
    ),
  );
}
