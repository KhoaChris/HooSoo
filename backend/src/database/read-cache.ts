import type { Table } from "@hoosoo/shared";

const MAX_ENTRIES = 256;
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_ENTRY_BYTES = 512 * 1024;
const values = new Map<
  string,
  { table: Table; value: unknown; expires: number; bytes: number }
>();
const pending = new Map<string, { table: Table; result: Promise<unknown> }>();
const versions = new Map<Table, number>();
let live = false;
let bytes = 0;
const counters = { hits: 0, misses: 0, joined: 0, invalidations: 0 };

function remove(key: string) {
  const entry = values.get(key);
  if (entry) bytes -= entry.bytes;
  values.delete(key);
}

export function invalidateReadCache(tables: readonly Table[] | null = null) {
  const affected = new Set(
    tables ?? [...values.values(), ...pending.values()].map((e) => e.table),
  );
  for (const table of affected)
    versions.set(table, (versions.get(table) ?? 0) + 1);
  for (const [key, entry] of values) if (affected.has(entry.table)) remove(key);
  for (const [key, entry] of pending)
    if (affected.has(entry.table)) pending.delete(key);
  counters.invalidations++;
}

// Completed reads may be reused only while the shared upstream listener is
// healthy. Closing/losing that listener immediately removes cached results.
export function setReadCacheLive(connected: boolean) {
  if (!connected || !live) invalidateReadCache();
  live = connected;
}

export async function cachedRead<T>(
  table: Table,
  key: string,
  load: () => Promise<T>,
  options: { fresh?: boolean; ttl?: number } = {},
): Promise<T> {
  const retain =
    !options.fresh && table !== "memberships" && table !== "receipts";
  const id = `${retain ? "data" : "fresh"}:${table}:${key}`;
  const existing = values.get(id);
  if (live && retain && existing && existing.expires > Date.now()) {
    counters.hits++;
    values.delete(id);
    values.set(id, existing);
    return structuredClone(existing.value) as T;
  }
  if (existing) remove(id);
  const active = pending.get(id);
  if (active) {
    counters.joined++;
    return structuredClone(await active.result) as T;
  }
  counters.misses++;
  const version = versions.get(table) ?? 0;
  const entry = {
    table,
    result: Promise.resolve().then(load) as Promise<unknown>,
  };
  pending.set(id, entry);
  try {
    const value = (await entry.result) as T;
    if (retain && live && (versions.get(table) ?? 0) === version) {
      const size = Buffer.byteLength(JSON.stringify(value));
      if (size <= MAX_ENTRY_BYTES) {
        while (values.size >= MAX_ENTRIES || bytes + size > MAX_BYTES)
          remove(values.keys().next().value!);
        values.set(id, {
          table,
          value: structuredClone(value),
          expires: Date.now() + (options.ttl ?? 60_000),
          bytes: size,
        });
        bytes += size;
      }
    }
    return structuredClone(value);
  } finally {
    if (pending.get(id) === entry) pending.delete(id);
  }
}

export function readCacheSnapshot() {
  return {
    ...counters,
    live,
    entries: values.size,
    bytes,
    maxBytes: MAX_BYTES,
  };
}

export function peekReadCache<T>(table: Table, key: string): T | undefined {
  const entry = values.get(`data:${table}:${key}`);
  if (!live || !entry || entry.expires <= Date.now()) return undefined;
  return structuredClone(entry.value) as T;
}
