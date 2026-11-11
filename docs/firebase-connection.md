# Firebase connection — 2026-11-11

The local frontend and backend are configured for **`hoosoo-37881`** in cloud mode. The initial connection checks passed, but at approximately 01:55 on 2026-11-11 (UTC+7), Firestore began rejecting operations with `8 RESOURCE_EXHAUSTED: Quota exceeded`. A later optimized cloud read briefly succeeded, but quota failures recur; stable cloud operation is not yet reverified. Public hosting has not been deployed.

## Current quota incident

Follow-up: the deeper [free-tier optimization](firebase-free-tier.md) supersedes the initial read-scope repair below. Mutations now use operation-specific records; listeners and client refreshes are shared/targeted, with measured per-route read counters and a 2,000-history-record regression benchmark.

The new **Chăm sóc khách hàng** department was successfully committed at 01:54:12 (UTC+7), at `organizations/hoosoo/departments/41e9fccb-bc46-4e83-8417-9ec3e986db6e`. Firebase Console showed the document with `active: true` and organization revision 32. The subsequent refresh failed; do not recreate that department.

The Spark project showed a no-cost-limit warning, and an independent Admin SDK document read returned `8 RESOURCE_EXHAUSTED: Quota exceeded`. The former error handler hid this as a generic connection failure. Every GET also loaded all 13 business collections, including growing audit and receipt history; multiple tabs, stream reconnects and focus refreshes amplified those reads.

The repair makes GET routes declare their required collections. `/me` now reads 3 collections and the organization tree 5, instead of 13. Concurrent reads of the same collection share only an in-flight query; completed records are not cached in the backend. Writes retain the existing atomic transaction, permission checks and idempotency receipt behavior. Mutation transactions still load the bounded organization state and need further repository changes for larger deployments.

Quota exhaustion now returns `FIRESTORE_QUOTA_EXCEEDED` and `Retry-After: 60`. A shared backend cooldown suppresses repeated Firestore calls; live streams honor the cooldown, do not invalidate queries for dependency failures and skip duplicate revision events after reconnect. The frontend does not automatically retry quota failures, starts live updates only after the session query succeeds, and respects query freshness on focus. A transient session refresh failure preserves already-mounted forms and explicitly labels previously loaded data; authentication/authorization failures still block access. Empty departments are visible in the organization chart.

Verification: 33 unit tests, 18 isolated integration tests, ESLint, TypeScript and the production build passed. The regression creates and persists a department, confirms its empty employee list in the organization API, checks replay does not duplicate it, and verifies that a later quota failure does not remove it. The isolated test services were stopped afterward; the running application still uses cloud, not emulators. Successful cloud create/read verification after this repair is pending quota recovery.

The free quota includes 50,000 document reads per day and resets around midnight Pacific time (approximately 15:00 Vietnam time on 2026-11-11). Restoring service sooner requires the project owner to enable billing; no billing plan was changed. See [Firestore quotas](https://firebase.google.com/docs/firestore/quotas). Reduced reads do not reset quota that is already exhausted.

## Run and sign in

From the project root, run in separate terminals:

```sh
npm run dev:backend
npm run dev:frontend
```

Open **http://127.0.0.1:5173**. Keep the same origin when testing session restoration. The frontend uses Vite's `/api/v1` proxy to the loopback API on port 4000.

Four synthetic accounts are available: `admin@hoosoo.example`, `hr@hoosoo.example`, `manager@hoosoo.example` and `employee@hoosoo.example`. Their generated passwords and UIDs are stored in owner-readable, ignored `backend/.secrets/demo-accounts.json`. Do not publish that file. These reserved `.example` email addresses cannot receive real password-reset mail; no email was sent during setup.

### Independent accounts in parallel tabs

Open the same **http://127.0.0.1:5173** URL in four fresh tabs and sign in as Admin, HR, Manager and Employee respectively. Only one frontend server and one backend server are needed.

- Each tab uses Firebase `browserSessionPersistence`: reloading preserves that tab's account, and signing in or out does not replace the accounts in other tabs.
- Open a fresh tab and enter the URL for a blank session. A browser's **Duplicate tab** action can copy the initial session into the new tab; subsequent sign-ins remain independent.
- Session storage normally ends when the tab/window closes. Browser restore behavior can preserve sessions, so use **Đăng xuất** when explicitly ending access.
- Existing tabs from the earlier shared-login version need one reload and sign-in. The named Firebase app `hoosoo-tab-session-v1` separates the new sessions from the old shared storage namespace, while still using the same Firebase project.

Only authentication is isolated. All tabs call the same authenticated backend and cloud Firestore database. The backend checks each account's permissions; writes commit before success is shown, and the live update stream refreshes data visible to the other accounts.

Verified in four Chrome tabs on the same origin on 2026-11-11: all roles remained distinct after reload and after Admin signed out and back in. Employee created unpaid leave `32636edb-ca2b-4a8a-a206-7783278bc5c5` for November 17; Manager approved it, and the other three tabs updated without reload. A separate Employee API read returned 200/`approved`; a direct cloud Firestore read confirmed Employee's creator UID and Manager's approver UID. Evidence: `output/firebase/tab-sessions-proof.json` and `output/firebase/tab-session-{admin,hr,manager,employee}.png`. ESLint, TypeScript, all 27 unit tests and the production build passed after the authentication change.

Reference: [Firebase Auth state persistence](https://firebase.google.com/docs/auth/web/auth-state-persistence).

## Configuration and keyless authentication

- `frontend/.env.local`: verified Firebase web configuration, cloud mode and local API proxy. Optional storage/sender/measurement values are preserved; Analytics collection is not initialized.
- `backend/.env`: matching project, cloud mode, loopback binding and local CORS origins. No emulator hosts or Admin private key.
- `.firebaserc`: default cloud project. Emulator commands explicitly select `demo-hoosoo`.
- Firestore `(default)`: Standard edition, Native mode, Singapore (`asia-southeast1`). Repository rules and indexes are deployed; browser clients cannot read/write business data directly.
- Firebase Authentication: Email/Password enabled, `localhost` authorized.

The Google Cloud CLI is installed locally at `/Users/grisky/.local/share/hoosoo-tools/google-cloud-sdk/bin/gcloud`. Local Application Default Credentials (ADC) impersonate `firebase-adminsdk-fbsvc@hoosoo-37881.iam.gserviceaccount.com`. The signed-in Google user has Service Account Token Creator on that service account, and the IAM Credentials API is enabled. No service-account private key was generated.

ADC resides at `/Users/grisky/.config/gcloud/application_default_credentials.json` with owner-only permissions. Its type is `impersonated_service_account`; it contains OAuth authentication material and must still be kept private. Keep `GOOGLE_APPLICATION_CREDENTIALS` unset to use this default location.

If Google access expires or is revoked, sign in again and restart the API:

```sh
/Users/grisky/.local/share/hoosoo-tools/google-cloud-sdk/bin/gcloud auth application-default login --impersonate-service-account=firebase-adminsdk-fbsvc@hoosoo-37881.iam.gserviceaccount.com --project=hoosoo-37881
npm run check:firebase
```

Do not append a positional email address to that command: the installed CLI version failed to decode an ID token in that variant. The command above was verified successfully. The first impersonation token exchange may take several seconds; the diagnostic allows 30 seconds for that step separately from database reads.

References: [Google local ADC and impersonation](https://docs.cloud.google.com/docs/authentication/set-up-adc-local-dev-environment), [Firebase Admin setup](https://firebase.google.com/docs/admin/setup).

## Collections synchronized with the API

All collections are subcollections of **`organizations/hoosoo`**, matching `backend/src/database/store.ts` and the shared domain model. Each is populated with valid demo records, not placeholder documents. Counts below were read after bootstrap and the API write/replay check:

| Collection                 | Documents | Purpose                                             |
| -------------------------- | --------: | --------------------------------------------------- |
| `employees`                |         4 | Employee profiles and manager/department references |
| `departments`              |         2 | Operations and Technology                           |
| `positions`                |         3 | Job positions                                       |
| `memberships`              |         4 | Auth UID, organization, role and employee linkage   |
| `attendanceRecords`        |         1 | Completed sample workday                            |
| `leaveTypes`               |         2 | Annual and unpaid leave                             |
| `leaveRequests`            |         1 | Manager-approved sample annual leave                |
| `leaveBalances`            |         4 | Annual balances                                     |
| `leaveBalanceTransactions` |         5 | Opening allocations and approved leave debit        |
| `auditLogs`                |         9 | Bootstrap, account and business operations          |
| `settings`                 |         1 | Organization, schedule and policies                 |
| `accountJobs`              |         3 | Provisioning workflow results                       |
| `receipts`                 |         9 | Idempotency and bootstrap markers                   |

The dedicated initializer uses the backend's account provisioning, attendance, leave, balance and command logic. It is restricted to this project and refuses an unrelated non-empty organization. Re-running it preserves data and reuses command receipts:

```sh
npm run bootstrap:demo-cloud -w backend -- --project hoosoo-37881
```

It requires the existing authorized Admin identity recorded in ignored `backend/.secrets/demo-access.json`. A second live run passed without creating duplicate accounts, attendance or leave records. Normal app activity can increase the table counts above.

## Review and verification

- Default builds use production configuration and reject emulator mode; `build:demo` remains explicit.
- Integration and domain tests force the isolated demo project even when local env files point to cloud. Browser fixture tests require the emulator badge before writing.
- Missing Admin credentials return a handled 503 instead of stopping the API during Firestore initialization.
- Login errors distinguish missing Auth configuration from incorrect credentials; cloud network errors no longer refer to an emulator.
- TypeScript, ESLint and the production build passed. The updated domain/configuration suite passed 24 tests; earlier emulator integration and client-denial rules suites passed 15 and 1 tests respectively.
- `npm run check:firebase` passed matching-project checks, credential exchange, Admin Auth, Firestore and initial Admin/settings verification.
- `npm run check:cloud-api` passed 24 checks: all four role sign-ins and memberships, 17 Admin read endpoints, restricted-role denials and Manager field filtering, a real profile write with idempotent replay, and CSV export. The profile write sends unchanged synthetic values and adds at most one receipt/audit per value pair. Result: `output/firebase/cloud-api-check.json`.
- The Admin browser session loaded the cloud dashboard with four employees and the approved leave record. A full-page reload restored the session on `/settings/system`, which displayed a successful real Firestore read (39 ms) in Firebase cloud mode. No browser errors or warnings were captured. Screenshot: `output/firebase/cloud-connected.png`.
- An unauthenticated Firestore document read returned 403 `PERMISSION_DENIED`, as intended by the deployed rules.

These checks cover the connected local app and synthetic business flows, not production hosting, real reset-mail delivery or load testing. Node 24 LTS is recommended; this machine currently uses Node 25 and the Firebase CLI dependency emitted an engine warning. The earlier dependency audit found 20 moderate and 1 low advisory, with no high/critical findings; dependency upgrades were not part of this connection change.

The workspace has no Git repository. Initial edit backups are under `/tmp/hoosoo-firebase-backup-2026-11-10`; the original source manifest refers to the earlier packaged snapshot, not this updated checkout.
