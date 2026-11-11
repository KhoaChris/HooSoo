# Live data flow and route checks

Verified against `hoosoo-37881` on 2026-11-11 (Vietnam time).

## Runtime behavior

The running app follows **React form → authenticated Express API → committed Firestore transaction → API response → query refresh → success message**. Firebase Authentication supplies an ID token; the backend checks organization membership and role before returning or changing records. A successful write response is sent only after Firestore commits. Successful mutations invalidate active API queries before displaying the saved message.

Open sessions also subscribe to `GET /api/v1/events` with their Firebase bearer token. One backend listener watches the organization document per API process; revisions and per-collection versions change atomically with business writes. Clients refetch only affected role-scoped APIs and coalesce simultaneous mutation/live signals. No business records or token are sent in the event payload/URL. New streams check access; employee or membership changes recheck access and close revoked streams. Streams expire with the token or after 55 minutes and reconnect with the current token. Heartbeats do not read Firestore. A watchdog and bounded retry handle disconnections; the footer reports the connection state. Focus/reconnect refresh remains enabled as a fallback. See [free-tier optimization and measured read counts](../firebase-free-tier.md).

This provides live updates for changes made through the application/API without requiring page reloads. Unsaved form input remains a local draft until the user submits it. Manual edits to individual documents in Firebase Console do not increment the application's organization revision; refresh the app to read those operator edits.

Business records are not kept in a mock server, localStorage or an in-memory fallback. React form state holds unsaved input; TanStack Query caches server responses temporarily. The backend loads Firestore records for domain validation and persists changed documents in a transaction before responding. If Firebase is unavailable, requests fail explicitly; the UI retains input and shows an error. API responses use `Cache-Control: no-store`.

The backend also reuses bounded, committed read results while its shared Firestore change listener is healthy. Transaction writes and fresh authorization checks bypass that cache; commits invalidate affected data. This is a performance cache, not a database substitute or outage fallback. See [backend read optimization](../backend-read-optimization.md) for cache lifetime, query behavior and measured results.

The initial employees and account names are synthetic sample content stored in the real Firebase project. The emulator and fixture code remains available only for explicitly isolated testing. The cloud runtime does not import the seed or test fixtures.

## UI → route → collection

All routes below are relative to `/api/v1`. Collections are under `organizations/hoosoo/`.

| UI operation                          | Actual API routes                                                                                                        | Firestore collections                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Create/view/process leave             | `POST /leave-requests`, `GET /leave-requests/:id`, `POST /leave-requests/:id/approve`, `/reject`, `/cancel`              | `leaveRequests`; approval/cancellation also updates `leaveBalances`, `leaveBalanceTransactions` |
| Edit own contact                      | `PATCH /me/profile`, `GET /me`                                                                                           | `employees`                                                                                     |
| Create/edit employee                  | `POST /employees`, `PATCH /employees/:id`, `GET /employees/:id`                                                          | `employees`; status changes may also change `memberships`                                       |
| Create/edit departments and positions | `GET/POST /departments`, `PATCH /departments/:id`; corresponding `/positions` routes                                     | `departments`, `positions`                                                                      |
| Check in/out and correct time         | `POST /attendance/check-in`, `/check-out`, `PATCH /attendance/:id/adjustment`, `GET /attendance`                         | `attendanceRecords`                                                                             |
| Company/work schedule                 | `GET/PATCH /settings`                                                                                                    | `settings/main`                                                                                 |
| Leave types and balances              | `GET/POST /leave-types`, `PATCH /leave-types/:id`, `GET /leave-balances`, `POST /leave-balances/:employeeId/adjustments` | `leaveTypes`, `leaveBalances`, `leaveBalanceTransactions`                                       |
| Account provisioning/permissions      | `GET/POST /users`, `PATCH /users/:uid/role`, `/status`                                                                   | Firebase Auth plus `memberships`, `accountJobs`, `employees`                                    |
| Dashboard, organization and reports   | `GET /dashboard`, `/organization/tree`, `/reports/:kind`, `/reports/export`                                              | Derived from the same persisted business records                                                |
| Audit/history                         | `GET /audit-logs`, `/employees/:id/history`                                                                              | `auditLogs`                                                                                     |

Business commands also write `auditLogs` and idempotency `receipts`. The complete request bodies, role restrictions and errors are in [the API contract](README.md).

## Check routes without copying tokens

Keep the API and Vite running. The local helper signs in with the selected existing synthetic account from ignored `backend/.secrets/demo-accounts.json`, then calls the same `/api/v1` proxy as the UI. It prints the HTTP status, `X-Request-Id` and response, never the password or token.

```sh
npm run api:request -- Admin GET /employees
npm run api:request -- Employee GET '/leave-requests?mine=true'
npm run api:request -- Admin GET /leave-requests/0f50f7a7-0418-4979-99db-f5cf81836db9
npm run api:request -- Admin GET '/audit-logs?search=0f50f7a7-0418-4979-99db-f5cf81836db9'
```

Explicit POST/PATCH calls make real changes. Supply a JSON body and optionally an idempotency key. Example (changes the synthetic Employee contact):

```sh
npm run api:request -- Employee PATCH /me/profile '{"phone":"","address":"Địa chỉ minh họa"}' profile-example-20261111
```

The helper prints a generated key before sending if none is provided. On a timeout, retry the exact method/path/body with the **same key**; a new operation needs a new key. The API rejects missing credentials with 401 and insufficient roles with 403. Opening a protected URL directly in the address bar supplies no bearer token, so 401 is expected.

In browser DevTools, open **Network → Fetch/XHR**, perform a UI action, then inspect its method, `/api/v1/...` URL, JSON payload, status and response. Use `X-Request-Id` to match the request to backend terminal logs. Do not share exported HAR files containing Authorization headers.

In Firebase Console, open **organizations → hoosoo → the target subcollection → document ID**. The parent document's `revision`/`updatedAt` are transaction metadata; employee and leave fields live in the subcollection documents. Refresh the Console after a write.

## Verification and scope

- UI-created leave: `leaveRequests/0f50f7a7-0418-4979-99db-f5cf81836db9`, Employee `demo-employee`, 2026-11-16. Its pending state and exact reason were read independently through both the API and Firebase Admin SDK. Evidence: `output/firebase/ui-created-leave.json`.
- UI contact update: `employees/demo-employee`; `/me` and an independent Firestore read returned the new address. A full browser reload preserved it.
- The Admin then approved that leave through the UI. Firestore retained the `created` and `approve` history, corresponding audit records, and the annual balance moved from 1 to 2 used days (10 remaining). A reload showed the approved status. Evidence: `output/firebase/ui-api-firestore-proof.json`, `output/firebase/ui-leave-persisted.png`, and `output/firebase/ui-profile-persisted.png`. The sample request is retained so it can be inspected through the routes above.
- `npm run check:firebase` checks matching projects, credentials and database initialization.
- `npm run check:cloud-api` checks the existing synthetic roles, API reads, permission denials, write/replay and CSV export. It performs one profile write using unchanged values.
- TypeScript, lint, 24 domain/configuration tests and production build passed after the UI refresh/header changes.
- Live synchronization update: 27 domain/client-stream tests and 16 isolated integration tests passed, including stream reconnection, fragmented frames, commit-before-response, event propagation and denied/revoked access. The application remains connected to Firebase cloud; automated failure/authorization tests use an isolated test database.
- A live cloud stream observed an edit submitted through the browser and the committed Firestore employee document. The signal arrived 206 ms after the recorded commit in that run. A second browser tab updated the address without reload. Evidence: `output/firebase/live-sync-proof.json`. This measurement is an observation, not a latency guarantee.

The current repository loads bounded organization data for domain operations (up to 100 employees). Query scaling remains a separate improvement. The tests above do not claim production load validation. A production reverse proxy must allow the event stream, disable response buffering and allow idle connections longer than the 15-second heartbeat (`X-Accel-Buffering: no` is sent).

Reference for focus refresh behavior: [TanStack Query window-focus refetching](https://tanstack.com/query/latest/docs/framework/react/guides/window-focus-refetching).

Live-update references: [Firestore snapshot listeners](https://firebase.google.com/docs/firestore/query-data/listen), [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events).
