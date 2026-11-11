# Navigation cache and Firestore read review

Reviewed on 2026-11-11. This change reduces redundant browser requests while preserving the existing authenticated API, Firestore writes, and live invalidation. Backend source and the running backend process were left untouched at the user's request. Tests used isolated synthetic data; they did not consume cloud Firestore quota.

Follow-up: the subsequently authorized [backend read optimization](backend-read-optimization.md) replaces the broad read/cache behavior described in this earlier review. The findings below document the state before that backend change.

## Findings

- Browser queries previously became stale after 15 seconds, so returning to a page triggered another GET. Focus and reconnect could trigger additional GETs.
- Department and position tables requested `?page=1`, while dropdowns requested `?pageSize=100`. These were separate cache entries for overlapping data.
- Employee and audit searches previously issued requests on every keystroke.
- In `backend/src/routes/helpers.ts`, a normal business GET reads the current membership and employee collection before reading the route's selected collections. `database/store.ts` shares concurrent reads but does not cache completed reads. Thus one HTTP GET can represent multiple document reads. For example, with four employees and two departments, a sequential department request can read 1 membership + 4 employees + 2 departments. This is a code-based example, not a measurement of the user's cloud data.
- Dashboard/report/history paths can read broad collections and filter them in memory. This remains a backend optimization opportunity. Changing those watched source files would reload the user's `tsx watch` process, so this change does not alter them.

The Firebase screenshot's approximately 2K reads is a cumulative project total, not a count of HTTP requests. It does not identify which routes produced those reads. This review does not attribute the entire total to one cause or claim a daily quota guarantee. Firebase's [billing documentation](https://firebase.google.com/docs/firestore/pricing) describes document/query/listener charges; [console data viewer reads also count](https://docs.cloud.google.com/firestore/native/docs/billing-questions).

## Implemented behavior

| Concern | Behavior |
| --- | --- |
| Business GET cache | Fresh for 5 minutes; retained in memory for 30 minutes while inactive |
| Navigation | Reuses fresh data; stale entries refresh on mount |
| Focus/reconnect | No business GET just from focusing a tab; reconnect only refetches stale queries |
| Session | `/me` stays on a shorter 60-second freshness window and can recheck on focus |
| Diagnostics | `/system/*` remains immediately stale, preserving explicit connectivity checks |
| Identity | Query keys include Firebase UID; sign-in/out clears the tab's cache and pending warmup |
| Catalog reuse | Table and dropdown share `?pageSize=100`; table slices that bounded response into pages of 20 |
| Preload | After successful session load, sequentially warm departments, positions, and first employee page for permitted roles; Employee does not prefetch the employee directory |
| Failures | Speculative warmup stops at the first error and does not retry |
| Search | Employee/audit text settles for 350 ms before requesting results |
| Save/live update | Existing collection dependency rules invalidate affected entries; active views refetch, inactive views refresh on next visit |
| Racing GETs | Cancel pre-commit reads before invalidation, so a late old response cannot replace new data |
| Abort | Cancelled requests waiting for an Auth token do not proceed to `fetch` |

Department and position capacities are currently 25 and 50, respectively. The shared full-catalog strategy depends on these remaining below the API's 100-item response limit. If these limits grow, replace this strategy with a proper paginated catalog/search endpoint.

This is an in-memory cache per browser tab, not persistent storage of personnel records. A hard browser reload still performs initial loading; separate role tabs have separate caches. First visits to new filters/detail/history pages may fetch. Writes continue through the API and are acknowledged after the existing backend transaction; caching never substitutes for a database write. The existing first/reconnected SSE invalidation is preserved to avoid missing changes during connection setup. There is no new polling interval.

Implementation: `frontend/src/services/query-cache.ts`, `services/query-sync.ts`, `hooks/navigation-cache.ts`, `hooks/data.ts`, `hooks/debounced-value.ts`. Catalog screens and dropdowns share `catalogPath`.

## Watch-Shop environment comparison

Only variable names, configuration code and redacted presence checks were compared. Watch-Shop was not modified or started.

| Purpose | Watch-Shop | HooSoo |
| --- | --- | --- |
| Admin authentication | `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`, passed to `cert()` | `applicationDefault()`; local ADC has type `impersonated_service_account` |
| Target | `FIREBASE_PROJECT_ID` | `FIREBASE_PROJECT_ID`; matches frontend's project |
| Allowed browser origins | `FRONTEND_URL` | `CORS_ORIGINS`, supporting several localhost origins |
| Mode | Cloud Admin configuration | Explicit `FIREBASE_MODE=cloud`; emulator host variables absent |
| Frontend Firebase | Separate frontend configuration | `VITE_*` values in `frontend/.env.local`, also cloud mode |
| Other services | Stripe, SMTP, storage and admin email settings | HR application settings and membership-based roles |

HooSoo's keyless configuration implements the user's earlier choice. The lack of a private key in `.env` is intentional; ADC can resolve credentials outside that file. See [Firebase Admin setup](https://firebase.google.com/docs/admin/setup) and [ADC lookup](https://docs.cloud.google.com/docs/authentication/application-default-credentials). Changing credential format does not reduce the document reads made by identical Firestore queries.

Both projects reuse a Firestore SDK instance. Watch-Shop's `getDb()` caches the instance, not the returned documents: catalog/product services still call `.get()`. The reported under-1K daily usage was not independently measured in this review. Startup URLs and console message formatting do not establish database read efficiency. HooSoo exposes `/api/health` for liveness and authenticated `/api/v1/*` routes; `/api/ready` performs a real database read.

## Validation and limits

- Real TanStack Query observers with simulated time: three rounds through Employees, Departments, Positions, with 20 seconds between screens, use **15 query fetches before vs 3 after**. This isolates navigation behavior; session bootstrap, SSE, cloud billing and unrelated pages are excluded.
- Browser review using actual page components/hooks and an isolated local fixture API: initial three list GETs; nine navigation clicks and catalog pagination add no GETs; typing a search issues one GET. Creating a department sends POST then refreshes the department query. A synthetic external department invalidation refreshes the catalog without refetching unrelated positions/employees.
- Regression cases cover cache expiry, parameter normalization, account separation/logout, quota-error warmup stop, membership invalidation, parsed SSE changes and late pre-commit responses.
- `npm test` runs existing backend unit tests plus `frontend/tests`. Typecheck, lint and frontend production build are also checked.
- No live Firebase read/write benchmark or backend restart was performed. The remaining broad backend reads mean this is not a complete database-query optimization or proof of a sub-1K daily total.

For route-level attribution during ordinary use, the existing Admin-only `GET /api/v1/system/usage` returns process counters (`byRoute`, `bySource`, `startedAt`). It is an SDK-operation estimate, not Google's billing report, and checking it currently reads the session's membership/employee. Compare snapshots around a fixed workflow instead of polling it. Backend logs also include request estimates. Keep testing on the existing process so its counters retain meaning.

TanStack references: [freshness defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), [prefetching](https://tanstack.com/query/latest/docs/framework/react/guides/prefetching), [invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation), [cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation).
