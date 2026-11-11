# Backend Firestore read optimization — 2026-11-11

The API keeps its existing paths, response shapes, domain rules, Firebase project and credential configuration. Writes still execute against Firestore in a transaction. No production data migration or new composite index is required.

## Storage and authorization

`routes/read-context.ts` separates current access from business data. Each request reads the caller's membership and employee document freshly. Employee detail reads only the target document. Manager directory reads use a fresh `managerId` query and the existing department/scope checks; a retained directory cannot override the fresh actor or hide a transfer/revocation.

`database/read-cache.ts` shares completed storage reads across browser sessions in the same API process. It caches raw organization-scoped records, not authorized HTTP responses: role filtering and field redaction still run per request. Memberships, explicit fresh authorization reads, receipts and transaction reads are never retained. Simultaneous reads may join one in-flight operation.

- Ordinary data expires after 60 seconds; departments, positions, leave types and settings after 5 minutes.
- Results are cloned for callers. Retained payloads are bounded to 256 entries and approximately 8 MiB of serialized data; a single entry larger than 512 KiB is not retained.
- A successful transaction invalidates only the changed collections, after commit and before returning success. Retries/replays keep existing transactional and idempotency rules.
- The existing shared organization listener invalidates changed collections **before** sending SSE notifications, including commits by another API process. Old in-flight reads cannot repopulate an invalidated cache.
- Completed-read caching is enabled only while that listener is healthy. Error/disconnect/last-subscriber cleanup clears and disables it. API-only usage without an active UI stream still uses targeted Firestore reads, without retained results. No polling timer or additional upstream listener was added.
- Direct console edits to ordinary business documents that do not update organization collection versions become visible after cache expiry/refetch. Authorization documents and Manager scope are freshly checked. API writes update those versions and invalidate immediately.

## Query changes

| Flow | Read strategy |
| --- | --- |
| Session/settings/leave types | Current actor plus declared data; no full employee-directory read |
| Employee detail/history | Target employee document, with history restricted by `targetId` |
| Shared catalogs/chart | Bounded cached directory/catalog data; current caller is still checked freshly |
| Personal/team attendance | Employee/date bounds using the established `employeeId_YYYY-MM-DD` document IDs |
| Company attendance | Requested date range in Firestore; existing scope/status logic still applies |
| Attendance leave conflicts | Leave requests whose `workDates` intersect the returned attendance dates |
| Dashboard | Today's attendance, pending requests, and ordered batches until five visible recent requests are found; includes older approved requests needed for today's conflict checks |
| Leave balances | Exact employee/year balance IDs; relevant employee/year ledger and pending requests |
| Audit list without substring search | Firestore aggregation count plus ordered cursor pages; cached count and prior-page cursor reused |
| CSV | Existing export behavior with the same scoped read plan as the corresponding report |

Audit ordering is descending creation time with Firestore's descending document-ID tie break. Numeric `page`, `pageSize`, `items` and `total` remain supported. Sequential pages use a cursor. A cold jump to a distant numeric page must still read preceding records if there is no saved cursor; the code does not use Firestore `offset()`.

Existing substring search semantics cannot be implemented as a native Firestore substring query. Audit searches therefore retain the bounded full-result filtering path. Ordinary leave lists and exports still load the relevant scoped records before their domain filters/pagination. A selective dashboard filter can require multiple ordered batches before finding five matches. These are remaining cost limits, not a guarantee that every endpoint reads only one page.

Native Firestore Timestamps are written by the existing transaction layer. A bounded format probe detects older imported ISO-string timestamps. Such mixed data uses the previous normalized sorting/filtering path to preserve results; it is not silently migrated. Date filters and total counts are retained for this fallback.

## Measured verification

Real Express/Auth/Admin SDK integration, using **isolated Firebase emulators** with 2,000 historical attendance records, 1,500 historical leave requests and 1,200 audit records. No cloud project was seeded for this benchmark.

| Operation | SDK document-operation estimate |
| --- | ---: |
| Previous dashboard read plan on the same fixture | 3,512 |
| Optimized dashboard, cold cache | 41 |
| Optimized dashboard, warm cache | 2 |
| Warm department list | 2 |
| Audit first page (20 rows) | 25 |
| Audit next page | 22 |
| Same audit page, warm cache | 2 |
| Employee attendance for one month | 19 |

The two reads retained in warm Admin requests are the current permission/profile checks. Aggregation counts include estimated index-read units, so these counters are estimates rather than Google's billing report. See `output/firebase/backend-read-optimization.json`.

After applying the tested source, a limited read-only smoke check against **cloud project `hoosoo-37881`** passed: the event stream connected, both department GETs returned identical results, dashboard and audit GETs returned HTTP 200, and usage snapshots showed four additional cache hits. The measured SDK read delta was 49, including diagnostic authorization and any concurrent browser activity; stream setup preceded that window. No business write or cloud fixture seed was performed. Evidence: `output/firebase/backend-cache-cloud-read-check.json`.

Integration checks compare role-scoped dashboard output with the original domain calculation, including filters and `mine`, and verify pagination, immediate membership revocation, terminated employment, Manager transfer, read after local commit, external-process invalidation, old approved leave conflicts and legacy timestamp compatibility. Cache unit tests cover expiry, cloning, failures, memory bounds, listener loss and stale in-flight responses.

Validation passed: 41 backend unit tests, 11 frontend regression tests, 20 Auth/API/Firestore integration tests, workspace typecheck, lint and production builds. Development/testing was performed in a separate temporary checkout; the verified source was then applied together. The existing development setup picked up the code change; no second backend server or cloud seed was started.

Run from the repository root:

```sh
npm test
npm run typecheck
npm run lint
npm run build
LOG_LEVEL=silent npx firebase emulators:exec --only auth,firestore --project demo-hoosoo --config firebase/firebase.json 'npm run test:integration'
```

Admin-only `GET /api/v1/system/usage` now includes `cache` counters/state alongside the existing read/write/route estimates. It costs fresh authorization reads itself; compare snapshots around a fixed workflow rather than polling. These optimizations do not promise a daily total below 1,000 or any other fixed threshold.

Official references: [query cursors](https://firebase.google.com/docs/firestore/query-data/query-cursors), [aggregation queries](https://firebase.google.com/docs/firestore/query-data/aggregation-queries), [Firestore billing](https://firebase.google.com/docs/firestore/pricing).
