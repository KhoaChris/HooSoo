import { FieldPath } from "firebase-admin/firestore";
import type {
  Actor,
  ChatMessage,
  ChatMessagePage,
  State,
} from "@hoosoo/shared";
import { actorFor } from "../../common/authorization";
import { loadEmployeeAccess } from "../../common/access-state";
import {
  mutate,
  mergeState,
  normalize,
  organization,
  timeout,
} from "../../database/store";
import { cachedRead } from "../../database/read-cache";
import { firestoreOperation } from "../../database/firestore-operation";
import { ensureFirebaseCredentials } from "../../config/firebase-admin";
import { env } from "../../config/env";
import { recordUsage } from "../../observability/firestore-usage";
import { assert } from "../../utils/errors";
import { chatId, messageId, roomFor } from "./chat.service";

// Authorization is re-read inside the transaction, including receipt replays.
export async function chatCommand<T>(
  uid: string,
  key: string | undefined,
  route: string,
  body: unknown,
  resolveRoomId: (a: Actor) => string,
  members: string[],
  operation: (s: State, a: Actor, id: string) => T,
) {
  assert(
    key && /^[A-Za-z0-9_-]{8,100}$/.test(key),
    400,
    "IDEMPOTENCY_KEY_REQUIRED",
    "Thiếu mã chống gửi lặp hợp lệ.",
  );
  const receiptId = chatId(uid + "|chat|" + key),
    fingerprint = chatId(route + "|" + JSON.stringify(body));
  return mutate(
    (s) => {
      const a = actorFor(s, uid),
        id = resolveRoomId(a),
        receipt = s.receipts[receiptId];
      if (receipt) {
        assert(
          receipt.fingerprint === fingerprint,
          409,
          "IDEMPOTENCY_CONFLICT",
          "Mã yêu cầu đã dùng cho nội dung khác.",
        );
        roomFor(s, a, id);
        return receipt.result as T;
      }
      const result = operation(s, a, id);
      s.receipts[receiptId] = {
        id: receiptId,
        actorId: uid,
        fingerprint,
        result,
      };
      return result;
    },
    async (read) => {
      const s = await read({
        memberships: { ids: [uid] },
        receipts: { ids: [receiptId] },
      });
      const employeeId = s.memberships[uid]?.employeeId;
      mergeState(
        s,
        await read({
          employees: {
            ids: [
              ...new Set([...(employeeId ? [employeeId] : []), ...members]),
            ],
          },
        }),
      );
      const a = actorFor(s, uid);
      mergeState(s, await read({ chatRooms: { ids: [resolveRoomId(a)] } }));
      if (!s.receipts[receiptId]) await loadEmployeeAccess(read, s, members);
      return s;
    },
  );
}

// IDs contain the monotonically increasing room sequence: a single-field index
// supports bounded forward/backward pages without offsets or composite indexes.
export function readMessages(
  roomId: string,
  sequence: number,
  after?: number,
  before?: number,
): Promise<ChatMessagePage> {
  return firestoreOperation(() =>
    timeout(
      cachedRead(
        "chatMessages",
        JSON.stringify({ roomId, sequence, after, before }),
        async () => {
          await ensureFirebaseCredentials();
          const low = after === undefined ? 1 : after + 1;
          const high =
            before === undefined ? sequence : Math.min(sequence, before - 1);
          if (high < low) return { items: [], hasMore: false };
          const pageLow = after === undefined ? Math.max(low, high - 39) : low;
          const snap = await organization
            .collection("chatMessages")
            .where(FieldPath.documentId(), ">=", messageId(roomId, pageLow))
            .where(FieldPath.documentId(), "<=", messageId(roomId, high))
            // The built-in document-name index is ascending. Bounded sequence
            // ranges give the newest page without a descending custom index.
            .orderBy(FieldPath.documentId(), "asc")
            .limit(40)
            .get();
          recordUsage("chatMessages", {
            reads: Math.max(1, snap.size),
            queries: 1,
          });
          const items = snap.docs
            .map((doc) => ({
              ...(normalize(doc.data()) as ChatMessage),
              id: doc.id,
            }))
            .sort((a, b) => a.sequence - b.sequence);
          return {
            items,
            hasMore:
              items.length === 40 &&
              (after === undefined
                ? items[0].sequence > 1
                : items.at(-1)!.sequence < sequence),
          };
        },
      ),
      env.DB_TIMEOUT_MS * 3,
    ),
  );
}
