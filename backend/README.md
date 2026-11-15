# Backend source map

Express API, Firebase Authentication and Firestore Admin SDK. Start with [`src/routes/index.ts`](src/routes/index.ts) to find an API group, then open that group's `*.routes.ts` file. The complete HTTP contract is in [`docs/api/README.md`](../docs/api/README.md).

## File layout

```text
backend/
  src/
    server.ts                    # Listen, startup errors and graceful shutdown
    app.ts                       # Express middleware, health, readiness and /api/v1
    config/
      env.ts                     # Load backend/.env and validate cloud/test mode
      firebase-admin.ts          # Firebase Auth, Firestore and ADC credentials
    routes/
      index.ts                   # Mount domain routers in API order
      helpers.ts                 # Validation, scoped reads and write handlers
      read-context.ts            # Fresh authorization and per-route read plans
    middleware/                  # Token verification, authorization, validation, errors
    modules/
      accounts/                  # /me, /users, Auth provisioning, last-Admin policy
      employees/                 # Employee routes, business rules and list queries
      organization/              # Departments, positions and organization tree
      attendance/                # Check-in/out, adjustments and attendance queries
      leave/                     # Leave requests, types, balances and ledger rules
      workflows/                 # Work registrations, internal requests, approval routing
      recruitment/               # Jobs, candidates, interview stages and original CV files
      dashboard/                 # Role-scoped dashboard route and aggregation
      reports/                   # Report routes and CSV export
      settings/                  # Company policies, audit logs and system endpoints
      events/                    # Authenticated SSE stream and connection cleanup
    common/
      authorization.ts           # Membership, roles, employee scope and field visibility
      command.ts                 # Idempotency receipts and replay authorization
      command-state.ts           # Minimal Firestore read plan for each write operation
      audit.ts                   # Append audit records to transactional state
      query.ts                   # Pagination, employee filters and date filters
      settings.ts                # Require initialized organization settings
    database/
      store.ts                   # Firestore reads, atomic writes, capacities, readiness
      read-cache.ts              # Bounded storage cache, commit/live invalidation
      ordered-reads.ts           # Audit cursors/counts and bounded recent leave reads
      firestore-operation.ts     # Dependency failures and quota cooldown
      live-hub.ts                # Shared organization listener and collection versions
    observability/
      firestore-usage.ts         # Per-request and per-process read/write counters
    utils/                       # Error types, Vietnam dates, attendance math and CSV
  scripts/
    check-env.ts                 # Configuration validation
    check-db.ts                  # One bounded database readiness check
    check-firebase.ts            # Frontend/backend Firebase connection diagnostics
    seed.ts                     # Existing emulator demo seed
    bootstrap-cloud-demo.ts      # Existing explicit cloud bootstrap command
    lib/demo-bootstrap.ts        # Synthetic bootstrap state, shared by script and tests
  tests/                         # Unit, API integration and Firestore rules suites
```

## Find a route

All paths below have the `/api/v1` prefix. Public `/api/health` and `/api/ready` remain in `src/app.ts`.

| API family | HTTP handlers | Related implementation |
| --- | --- | --- |
| `/me`, `/users` | [accounts.routes.ts](src/modules/accounts/accounts.routes.ts) | `accounts.service.ts`, `accounts.policy.ts` |
| `/employees` | [employees.routes.ts](src/modules/employees/employees.routes.ts) | `employees.service.ts`, `employees.queries.ts` |
| `/departments`, `/positions`, `/organization/tree` | [organization.routes.ts](src/modules/organization/organization.routes.ts) | `organization.service.ts` |
| `/attendance` | [attendance.routes.ts](src/modules/attendance/attendance.routes.ts) | `attendance.service.ts`, `attendance.queries.ts` |
| `/leave-requests`, `/leave-types`, `/leave-balances` | [leave.routes.ts](src/modules/leave/leave.routes.ts) | `leave.service.ts`, `leave-types.service.ts`, `balances.service.ts`, and matching queries |
| `/dashboard` | [dashboard.routes.ts](src/modules/dashboard/dashboard.routes.ts) | `dashboard.queries.ts` composes domain queries |
| `/reports/*`, `/reports/export` | [reports.routes.ts](src/modules/reports/reports.routes.ts) | Reuses employee, attendance, leave and balance queries |
| `/settings`, `/audit-logs`, `/system/status`, `/system/usage` | [settings.routes.ts](src/modules/settings/settings.routes.ts) | Common settings/audit helpers, database readiness and usage counters |
| `/events` | [events.routes.ts](src/modules/events/events.routes.ts) | `database/live-hub.ts` |

## Naming and responsibilities

- `*.routes.ts`: register HTTP paths, validate input and shape responses. Small route-specific handlers remain beside their route.
- `*.service.ts`: business operations on transaction state. Account provisioning also coordinates Firebase Auth with durable Firestore jobs.
- `*.queries.ts`: filter, scope and shape loaded domain state for responses. Storage reads are prepared by the shared route helpers.
- `*.policy.ts`: rules specific to a domain; shared authorization stays in `common/authorization.ts`.
- `database/`: Firestore access and live listeners. Firestore paths remain `organizations/{ORG_ID}/{collection}/{documentId}`.

For example, creating a department follows `organization.routes.ts` → `routes/helpers.ts` → `common/command.ts` + `command-state.ts` → `database/store.ts`, with `organization.service.ts` applying the business rules inside the transaction. After commit, collection-version changes feed `/events`; the frontend refreshes the affected API queries.

The main request flow, Firebase project, environment file locations, collection names, API paths and npm command names are preserved. Test credentials and environment overrides remain isolated in `vitest.config.ts`; normal development continues to use the existing cloud `.env`.

## API explorer

Open the URL printed by `npm run dev` (normally `http://127.0.0.1:4000/`) for the grouped, searchable API explorer. The catalog is derived from the routers registered in `src/routes/index.ts`; it reads no application records. Static assets live in `public/api-explorer/` and are copied to `dist/public/api-explorer/` during the backend build, so the explorer also works with `npm start`.

Opening the page, searching, filtering, and selecting routes do not call business endpoints. A finite GET request runs only when **Gửi kiểm tra** is pressed, with a 15-second timeout and no retries or polling. `/api/health` checks process liveness without Firestore. `/api/ready` and `/api/v1/system/status` perform database readiness checks; other authenticated GET requests may read Firestore under the existing cache and access policies. The explorer never subscribes to `/api/v1/events`.

Protected requests require a Firebase ID token, held only in the current page's memory. Existing authentication and role/object scope checks remain in force. Copied cURL commands use `$FIREBASE_ID_TOKEN`, never the entered token. Write routes are listed with their required headers but are not executed by this page; use the application or an API client with `Idempotency-Key` and the relevant schema in `shared/src/`. The explorer is a route browser, not a full OpenAPI request-body specification.

Run `npm exec -w backend -- vitest run tests/api-explorer.test.ts` from the repository root to verify route coverage, access protection, static serving, and zero Firebase calls during browsing. These tests do not require cloud access or a running emulator.

## Checks

See [backend read optimization](../docs/backend-read-optimization.md) for the cache lifecycle, authorization guarantees, scoped queries, remaining scan paths and measured SDK read counts. The cache uses the existing organization listener; transaction writes and authorization checks continue to reach Firestore.

Run from the repository root:

```sh
npm run typecheck
npm run lint
npm test
npm run build
npx firebase emulators:exec --only auth,firestore --project demo-hoosoo --config firebase/firebase.json 'npm run test:integration && npm run test:rules'
```

The last command starts isolated test services, runs API/Auth/Firestore checks, then stops them. It does not change the application's cloud configuration. Test success establishes local behavior; live cloud availability is a separate check. See [verification guide](../docs/testing/README.md) and [structure review](../docs/backend-structure-review.md).

## Workflow and recruitment routes

`modules/workflows/workflows.routes.ts` owns `/work-registrations` and `/internal-requests`. `approval.ts` implements manager then HR/Admin approval; `workflows.reads.ts` prepares scoped reads and transactional command state. `modules/recruitment/recruitment.routes.ts` owns `/recruitment/*`; its service validates job stages, candidate progression, interviews and CV access.

See [workflow contracts](../docs/hr-workflows.md) for permissions, storage and limits. Existing API paths and Firebase configuration remain unchanged. The five new collections use the existing transaction, cache and event infrastructure.

## Hierarchy and professional work

`shared/src/access/` defines 14 access roles independently of job titles. `common/authorization.ts` enforces scope and strict target hierarchy on personnel changes and approvals. `modules/professional/` owns `/professional/workspace` and versioned `/professional/work-items` operations stored in Firestore `workItems`. Admin can add missing IT job titles through `/positions/templates`. See [access and specialty contracts](../docs/access-and-specialties.md) for the role matrix, safeguards, routes and verification scope.

## Notification feed

`GET /api/v1/notifications` is implemented in `modules/notifications/notifications.routes.ts`. It returns up to 40 recent items derived from the current user's chat rooms, their own requests, and requests they can approve under existing hierarchy rules. It does not expose private message text or add a Firestore notification collection. Read selections reuse the repository cache and existing live invalidation. The frontend refreshes this feed only through normal query lifecycle or relevant collection changes, not a new polling timer.

## Legacy account identity cleanup

`scripts/normalize-account-identities.ts` migrates legacy employee names, codes and document IDs containing `Demo` in the existing `hoosoo-37881` organization. It updates linked records, deterministic attendance/balance/schedule keys and direct-chat/message keys in one transaction. Auth UIDs, credentials, permissions, message content and historical audit facts are preserved. New employee codes continue after the stored `HS-xxxxxx` sequence.

From the repository root, preview with `node --import tsx backend/scripts/normalize-account-identities.ts --project=hoosoo-37881`. Add `--apply` to migrate. A private backup with exact Firestore timestamps is saved in `backend/.secrets/identity-migrations/` before writes. This is a small-data migration with a conservative atomic-write limit; it refuses oversized collections or ID collisions. Rerunning after completion does not renumber employees. Auth display-name synchronization can be retried independently by rerunning the same command.

The script updates the existing collection-version signals so connected sessions refresh without restarting the API. Previously bookmarked employee/detail or direct-chat URLs containing an old ID must be reopened from the current list. Do not rerun the original cloud bootstrap against this migrated organization. Run the focused local tests from `backend/` with `npx vitest run tests/account-identities.test.ts`.

## Supervisor-led performance reviews

`modules/performance/` owns `/performance/reviews` and `/performance/reports`. Supervisors create and assess lower-ranking employees within their existing department or direct-report scope. Individual reviews can be published by their evaluator without an HR approval step. Employees can read published results and acknowledge them; the legacy `/self` endpoint rejects writes. Existing self-assessment evidence remains readable without a database migration.

A supervisor can select up to 20 completed assessments and send a report to an eligible superior. Submission atomically locks all entries for the assigned reviewer. That reviewer can amend assessments with a reason, return the report for revision, or publish all results together. Returned entries must go back to the same reviewer; authors cannot bypass the report by publishing individually. Finalized reports remain locked. Version checks and idempotency receipts protect concurrent and repeated submissions. Assessment revisions preserve prior submitted content and attribution.

Reports are stored in `organizations/{ORG_ID}/performanceReports`; reviews remain in `performanceReviews`. Both use the existing cache, transaction and collection-change notification infrastructure. There is no new polling timer. Read paths filter by employee/report scope; writes load only affected records and fresh authorization dependencies. Tests in `tests/performance.test.ts` and `tests/hr-api.test.ts` exercise direct publication, report decisions, returned revisions, hierarchy and scope enforcement without cloud reads.
