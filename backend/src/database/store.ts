import {
  FieldValue,
  FieldPath,
  Timestamp,
  type Transaction,
  type Query,
} from "firebase-admin/firestore";
import { db, ensureFirebaseCredentials } from "../config/firebase-admin";
import { ORG_ID, env } from "../config/env";
import type { State, Table } from "@hoosoo/shared";
import { AppError, assert } from "../utils/errors";
import { firestoreOperation } from "./firestore-operation";
import { recordUsage } from "../observability/firestore-usage";
import { cachedRead, invalidateReadCache } from "./read-cache";

export type ReadFilter = {
  field: string;
  value: string | number | string[];
  op?: "==" | "in" | ">=" | "<=" | "<" | "array-contains-any";
};
export type ReadSelection =
  | true
  | { ids: readonly string[] }
  | ReadFilter
  | { filters: readonly ReadFilter[] }
  | { any: readonly ReadSelection[] };

export type ReadPlan = Partial<Record<Table, ReadSelection>>;
export type StateReader = (plan: ReadPlan) => Promise<State>;
export const capacities: Record<Table, number> = {
  workItems: 3000,
  workRegistrations: 5000,
  internalRequests: 3000,
  recruitmentJobs: 100,
  candidates: 2000,
  candidateFiles: 16000,
  employees: 100,
  departments: 25,
  positions: 50,
  memberships: 150,
  attendanceRecords: 10000,
  leaveTypes: 20,
  leaveRequests: 3000,
  leaveBalances: 1000,
  leaveBalanceTransactions: 5000,
  auditLogs: 10000,
  settings: 1,
  accountJobs: 150,
  receipts: 10000,
};
export const tables = Object.keys(capacities) as Table[];
export const organization = db.collection("organizations").doc(ORG_ID);
export function emptyState(): State {
  return Object.fromEntries(tables.map((k) => [k, {}])) as State;
}
export function normalize(v: unknown): unknown {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (Array.isArray(v)) return v.map(normalize);
  if (v && typeof v === "object")
    return Object.fromEntries(
      Object.entries(v).map(([k, x]) => [k, normalize(x)]),
    );
  return v;
}
async function readTable(
  k: Table,
  tx?: Transaction,
  selection: NonNullable<ReadPlan[Table]> = true,
  fresh = false,
): Promise<State[Table]> {
  const key = k + JSON.stringify(selection);
  const query = async () => {
    if (selection !== true && "any" in selection) {
      const result = Object.assign(
        {},
        ...(await Promise.all(
          selection.any.map((part) => readTable(k, tx, part, fresh)),
        )),
      );
      assert(
        Object.keys(result).length <= capacities[k],
        503,
        "CAPACITY_REACHED",
        "Dữ liệu vượt giới hạn phiên bản thử nghiệm.",
      );
      return result as State[Table];
    }
    if (selection !== true && "ids" in selection) {
      const docs = await Promise.all(
        [...new Set(selection.ids)].map(async (id) => {
          const ref = organization.collection(k).doc(id);
          const snap = tx ? await tx.get(ref) : await ref.get();
          recordUsage(k, { reads: 1 });
          return snap;
        }),
      );
      return Object.fromEntries(
        docs
          .filter((d) => d.exists)
          .map((d) => [d.id, { ...(normalize(d.data()) as object), id: d.id }]),
      ) as State[Table];
    }
    let q: Query = organization.collection(k);
    if (selection !== true) {
      const filters = "filters" in selection ? selection.filters : [selection];
      for (const filter of filters)
        q = q.where(
          filter.field === "__name__" ? FieldPath.documentId() : filter.field,
          filter.op || "==",
          filter.value,
        );
    }
    q = q.limit(capacities[k] + 1);
    const snap = tx ? await tx.get(q) : await q.get();
    recordUsage(k, { reads: Math.max(1, snap.size), queries: 1 });
    assert(
      snap.size <= capacities[k],
      503,
      "CAPACITY_REACHED",
      "Dữ liệu vượt giới hạn phiên bản thử nghiệm. Cần nâng cấp chiến lược truy vấn.",
    );
    return Object.fromEntries(
      snap.docs.map((d) => [
        d.id,
        {
          ...(normalize(d.data()) as object),
          id: d.id,
        },
      ]),
    ) as State[Table];
  };
  if (tx) return query();
  return cachedRead(k, key, query, {
    fresh,
    ttl: ["departments", "positions", "leaveTypes", "settings"].includes(k)
      ? 300_000
      : 60_000,
  });
}
async function load(
  tx?: Transaction,
  plan: ReadPlan = Object.fromEntries(tables.map((k) => [k, true])),
  fresh = false,
) {
  await ensureFirebaseCredentials();
  const s = emptyState();
  await Promise.all(
    (Object.keys(plan) as Table[]).map(async (k) => {
      s[k] = (await readTable(k, tx, plan[k], fresh)) as never;
    }),
  );
  return s;
}
function persist(tx: Transaction, before: State, after: State) {
  const changed = new Set<Table>();
  for (const k of tables) {
    assert(
      Object.keys(after[k]).length <= capacities[k],
      409,
      "CAPACITY_REACHED",
      "Đã đạt giới hạn dữ liệu phiên bản thử nghiệm.",
    );
    for (const [id, value] of Object.entries(after[k])) {
      const prev = before[k][id];
      if (JSON.stringify(prev) !== JSON.stringify(value)) {
        changed.add(k);
        recordUsage(k, { writes: 1 });
        tx.set(organization.collection(k).doc(id), {
          ...value,
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: prev?.createdAt
            ? Timestamp.fromDate(new Date(prev.createdAt))
            : FieldValue.serverTimestamp(),
        });
      }
    }
  }
  return [...changed];
}
export async function readState(
  selected: readonly Table[] = tables,
  overrides: ReadPlan = {},
  options: { fresh?: boolean } = {},
) {
  return firestoreOperation(() =>
    timeout(
      load(
        undefined,
        {
          ...Object.fromEntries(selected.map((k) => [k, true])),
          ...overrides,
        },
        options.fresh,
      ),
      env.DB_TIMEOUT_MS * 3,
    ),
  );
}
export function mergeState(target: State, source: State) {
  for (const table of tables) Object.assign(target[table], source[table]);
  return target;
}
export async function mutate<T>(
  operation: (s: State) => T,
  prepare?: ReadPlan | ((read: StateReader) => Promise<State>),
): Promise<T> {
  return firestoreOperation(async () => {
    await timeout(ensureFirebaseCredentials(), env.DB_TIMEOUT_MS);
    const result = await db.runTransaction(
      async (tx) => {
        await tx.get(organization);
        recordUsage("organization", { reads: 1, transactions: 1 });
        const s =
          typeof prepare === "function"
            ? await prepare((plan) => load(tx, plan))
            : await load(tx, prepare);
        const before = structuredClone(s);
        const result = operation(s);
        const changed = persist(tx, before, s);
        // Receipt replays and receipt-only writes must not wake every client.
        if (changed.some((k) => k !== "receipts")) {
          recordUsage("organization", { writes: 1 });
          tx.set(
            organization,
            {
              updatedAt: FieldValue.serverTimestamp(),
              revision: FieldValue.increment(1),
              collectionVersions: Object.fromEntries(
                changed
                  .filter((k) => k !== "receipts")
                  .map((k) => [k, FieldValue.increment(1)]),
              ),
            },
            { merge: true },
          );
        }
        return { result, changed };
      },
      { maxAttempts: 5 },
    );
    invalidateReadCache(result.changed);
    return result.result;
  });
}
export async function timeout<T>(promise: Promise<T>, ms: number) {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new AppError(
                503,
                "DEPENDENCY_UNAVAILABLE",
                "Không kết nối được cơ sở dữ liệu. Vui lòng thử lại.",
              ),
            ),
          ms,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}
export async function readiness() {
  const start = Date.now();
  await firestoreOperation(() =>
    timeout(
      ensureFirebaseCredentials().then(async () => {
        const doc = await organization.get();
        recordUsage("organization", { reads: 1 });
        return doc;
      }),
      env.DB_TIMEOUT_MS,
    ),
  );
  return {
    status: "ok",
    api: "ok",
    firestore: "ok",
    mode: env.FIREBASE_MODE,
    checkedAt: new Date().toISOString(),
    latencyMs: Date.now() - start,
  };
}
