import { AsyncLocalStorage } from "node:async_hooks";

type Counts = {
  reads: number;
  writes: number;
  queries: number;
  transactions: number;
};
const zero = (): Counts => ({
  reads: 0,
  writes: 0,
  queries: 0,
  transactions: 0,
});
export const requestUsage = new AsyncLocalStorage<Counts>();
const startedAt = new Date().toISOString();
const total = zero();
const bySource: Record<string, Counts> = {};
const byRoute: Record<string, Counts & { requests: number }> = {};
export function recordUsage(source: string, counts: Partial<Counts>) {
  const row = (bySource[source] ||= zero());
  const request = requestUsage.getStore();
  for (const key of Object.keys(counts) as (keyof Counts)[]) {
    total[key] += counts[key]!;
    row[key] += counts[key]!;
    if (request) request[key] += counts[key]!;
  }
}
export function recordRequest(route: string, counts: Counts) {
  const row = (byRoute[route] ||= { ...zero(), requests: 0 });
  row.requests++;
  for (const key of Object.keys(counts) as (keyof Counts)[])
    row[key] += counts[key];
}
export function usageSnapshot() {
  return structuredClone({
    startedAt,
    total,
    bySource,
    byRoute,
    note: "SDK document-operation estimates for this API process, including empty queries and transaction attempts; not Google's billing report.",
  });
}
export const newUsage = zero;
