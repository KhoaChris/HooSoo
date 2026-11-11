import {
  FieldPath,
  Timestamp,
  type Query as FirestoreQuery,
} from "firebase-admin/firestore";
import type { Audit, LeaveRequest, Page, Query } from "@hoosoo/shared";
import { ensureFirebaseCredentials } from "../config/firebase-admin";
import { env } from "../config/env";
import {
  organization,
  normalize,
  capacities,
  timeout,
  readState,
} from "./store";
import { paginate } from "../common/query";
import { cachedRead, peekReadCache } from "./read-cache";
import { firestoreOperation } from "./firestore-operation";
import { recordUsage } from "../observability/firestore-usage";
import { assert } from "../utils/errors";

type OrderedTable = "auditLogs" | "leaveRequests";
type Cursor = { seconds: number; nanoseconds: number; id: string };
type Chunk<T> = { items: T[]; cursor?: Cursor };
type Bounds = { startDate?: string; endDate?: string };

async function hasLegacyDates(table: OrderedTable) {
  return cachedRead(table, "legacy-date-format", async () => {
    // Older imports can contain ISO strings; mixing them with native Timestamps
    // would change Firestore's type ordering. Preserve their existing semantics.
    const result = await organization
      .collection(table)
      .where("createdAt", ">=", "")
      .where("createdAt", "<=", "\uf8ff")
      .limit(1)
      .get();
    recordUsage(`${table}:date-format`, {
      reads: Math.max(1, result.size),
      queries: 1,
    });
    return !result.empty;
  });
}

function orderedQuery(
  table: OrderedTable,
  bounds: Bounds = {},
): FirestoreQuery {
  let query: FirestoreQuery = organization.collection(table);
  if (bounds.startDate)
    query = query.where(
      "createdAt",
      ">=",
      Timestamp.fromDate(new Date(bounds.startDate)),
    );
  if (bounds.endDate)
    query = query.where(
      "createdAt",
      "<",
      Timestamp.fromMillis(Date.parse(bounds.endDate) + 86400000),
    );
  // Same direction as the single-field index; no new composite index required.
  return query
    .orderBy("createdAt", "desc")
    .orderBy(FieldPath.documentId(), "desc");
}

async function chunk<T>(
  table: OrderedTable,
  limit: number,
  bounds: Bounds,
  cursor?: Cursor,
): Promise<Chunk<T>> {
  return cachedRead(
    table,
    `ordered:${JSON.stringify({ bounds, cursor, limit })}`,
    async () => {
      let query = orderedQuery(table, bounds);
      if (cursor)
        query = query.startAfter(
          new Timestamp(cursor.seconds, cursor.nanoseconds),
          cursor.id,
        );
      const snap = await query.limit(limit).get();
      recordUsage(table, { reads: Math.max(1, snap.size), queries: 1 });
      const last = snap.docs.at(-1);
      const time = last?.get("createdAt") as Timestamp | undefined;
      return {
        items: snap.docs.map(
          (doc) => ({ ...(normalize(doc.data()) as object), id: doc.id }) as T,
        ),
        ...(last && time
          ? {
              cursor: {
                seconds: time.seconds,
                nanoseconds: time.nanoseconds,
                id: last.id,
              },
            }
          : {}),
      };
    },
  );
}

export async function readAuditPage(q: Query): Promise<Page<Audit>> {
  return firestoreOperation(() =>
    timeout(
      (async () => {
        await ensureFirebaseCredentials();
        if (await hasLegacyDates("auditLogs")) {
          const state = await readState(["auditLogs"]);
          return paginate(
            Object.values(state.auditLogs)
              .filter(
                (row) =>
                  (!q.startDate || (row.createdAt || "") >= q.startDate) &&
                  (!q.endDate ||
                    (row.createdAt || "").slice(0, 10) <= q.endDate),
              )
              .sort((a, b) =>
                (b.createdAt || "").localeCompare(a.createdAt || ""),
              ),
            q,
          );
        }
        const bounds = { startDate: q.startDate, endDate: q.endDate };
        const signature = JSON.stringify(bounds);
        const total = await cachedRead(
          "auditLogs",
          `count:${signature}`,
          async () => {
            const result = await orderedQuery("auditLogs", bounds)
              .count()
              .get();
            const count = result.data().count;
            recordUsage("auditLogs:count", {
              reads: Math.max(1, Math.ceil(count / 1000)),
              queries: 1,
            });
            assert(
              count <= capacities.auditLogs,
              503,
              "CAPACITY_REACHED",
              "Dữ liệu vượt giới hạn phiên bản thử nghiệm.",
            );
            return count;
          },
        );
        const key = (page: number) => `page:${signature}:${q.pageSize}:${page}`;
        const result = await cachedRead("auditLogs", key(q.page), async () => {
          const offset = (q.page - 1) * q.pageSize;
          if (offset >= total) return { items: [] } as Chunk<Audit>;
          let previous = 0;
          let cursor: Cursor | undefined;
          for (let page = q.page - 1; page > 0; page--) {
            const saved = peekReadCache<Chunk<Audit>>("auditLogs", key(page));
            if (saved?.cursor) {
              previous = page;
              cursor = saved.cursor;
              break;
            }
          }
          // Sequential next-page visits use a cursor. A cold random page must still
          // walk earlier records to preserve the existing numeric-page API; never
          // use Firestore offset(), which also bills for skipped documents.
          const fetched = await chunk<Audit>(
            "auditLogs",
            (q.page - previous) * q.pageSize,
            bounds,
            cursor,
          );
          return {
            ...fetched,
            items: fetched.items.slice((q.page - previous - 1) * q.pageSize),
          };
        });
        return {
          items: result.items,
          total,
          page: q.page,
          pageSize: q.pageSize,
        };
      })(),
      env.DB_TIMEOUT_MS * 3,
    ),
  );
}

// Dashboard needs five visible recent requests, not the entire leave history.
// Filter each bounded batch with the existing domain policy before returning.
export async function readRecentLeaves(
  matches: (row: LeaveRequest) => boolean,
): Promise<LeaveRequest[]> {
  return firestoreOperation(() =>
    timeout(
      (async () => {
        await ensureFirebaseCredentials();
        if (await hasLegacyDates("leaveRequests")) {
          const state = await readState(["leaveRequests"]);
          return Object.values(state.leaveRequests)
            .filter(matches)
            .sort((a, b) =>
              (b.createdAt || "").localeCompare(a.createdAt || ""),
            )
            .slice(0, 5);
        }
        const rows: LeaveRequest[] = [];
        let cursor: Cursor | undefined;
        let scanned = 0;
        while (rows.length < 5) {
          const result = await chunk<LeaveRequest>(
            "leaveRequests",
            25,
            {},
            cursor,
          );
          scanned += result.items.length;
          assert(
            scanned <= capacities.leaveRequests,
            503,
            "CAPACITY_REACHED",
            "Dữ liệu vượt giới hạn phiên bản thử nghiệm.",
          );
          rows.push(...result.items.filter(matches));
          if (result.items.length < 25 || !result.cursor) break;
          cursor = result.cursor;
        }
        return rows.slice(0, 5);
      })(),
      env.DB_TIMEOUT_MS * 3,
    ),
  );
}
