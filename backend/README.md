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
