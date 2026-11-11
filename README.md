# HooSoo

A standalone HR management demo by **Bùi Đức Đăng Khoa (22114833)**. React/TypeScript frontend, Express/TypeScript API, Firebase Authentication and Firestore. All organization records are synthetic. HooSoo is not a Lạc Việt/SureHCS product and contains no company source, branding, accounts, or customer data.

The current workspace is connected to Firebase project **`hoosoo-37881`** in ignored `frontend/.env.local` and `backend/.env` files. The backend uses Google ADC with service-account impersonation; no service-account private key was created. All 13 API collections and four synthetic accounts are initialized. See [Firebase connection status](docs/firebase-connection.md) for access, startup and verified checks. The emulator quick start below replaces that configuration; keep the cloud env files before switching.

**Current cloud limitation (2026-11-11):** Firestore is returning `RESOURCE_EXHAUSTED: Quota exceeded` on the Spark project. The latest department was committed before the refresh failed. Scoped reads and quota backoff are implemented, but stable cloud recovery is not yet verified. Spark is retained as requested; see the incident notes in the connection status above.

The subsequent [free-tier optimization](docs/firebase-free-tier.md) removes whole-history transaction reads, targets client refreshes and shares one live listener per API process. Its isolated benchmark measured 3 reads for a session and 4 for a profile save even with 2,000 added history records. Admins can inspect current-process counters through `GET /api/v1/system/usage`.

## Local quick start

For frontend navigation and styling, see the [source map](frontend/README.md). Screens live in `frontend/src/pages/`; shared controls live in `components/ui/`, and CSS is organized under `style/` by page/component.

For API navigation, see the [backend source map](backend/README.md). Each business area groups its routes, services and queries under `backend/src/modules/`; shared request handling, Firestore access and usage counters have separate folders.

Use **Node 24 LTS**, npm, Java 21+ and Chrome (for browser tests). The project contains npm workspaces; install from this directory.

```sh
npm install
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env
npm run check:env -w frontend
npm run check:env -w backend
```

The `.env.example` values are safe, fake configuration for `demo-hoosoo`. No Firebase cloud project or service-account credential is required. Do not add cloud credentials while emulator mode is enabled. If the machine-wide npm cache has an ownership error, use `npm install --cache /tmp/hoosoo-npm-cache` rather than changing global permissions.

Start three terminals in the project root:

```sh
# Terminal 1 — Auth 9099, Firestore 8080, emulator UI 4401
npm run emulators

# Terminal 2 — Express http://127.0.0.1:4000
npm run dev:backend

# Terminal 3 — Vite http://127.0.0.1:5173
npm run dev:frontend
```

After the emulator is ready:

```sh
npm run check:db -w backend
npm run seed
```

Open **http://127.0.0.1:5173**. Authentication is isolated per tab and survives reload: open fresh tabs to use Admin, HR, Manager and Employee simultaneously. All tabs share the same API/database and receive permitted live data updates. Use the same origin consistently; Firebase sessions are origin-specific. `localhost:5173` is also in the API CORS allowlist. `/api` is proxied by Vite. Frontend and backend also run independently using `cd frontend && npm run dev` and `cd backend && npm run dev`; ports are fixed, so stop another process or choose explicit configuration rather than silently switching ports.

### Local demo accounts

All five local demo accounts initially use **`HooSooDemo!2026`**. These are synthetic emulator-only accounts, not production credentials. Optionally set `DEMO_PASSWORD` in the ignored backend `.env` **before the first seed**. Existing passwords and existing business records are preserved on subsequent seed runs.

| Email                | Role     | Employee / scope                               |
| -------------------- | -------- | ---------------------------------------------- |
| admin@hoosoo.demo    | Admin    | Trần Minh Khôi / all records                   |
| nhansu@hoosoo.demo   | HR       | Nguyễn An Nhiên / HR business operations       |
| quanly@hoosoo.demo   | Manager  | Nguyễn Duy Khang / direct reports in Công nghệ |
| nhanvien@hoosoo.demo | Employee | Bùi Đức Đăng Khoa / own records                |
| quanly2@hoosoo.demo  | Manager  | Vũ Minh Anh / direct reports in Kinh doanh     |

The initial seed has 25 employees, five departments, three leave types, historical attendance, leave states, balance ledger and audit records. It is non-destructive and rerunnable. Auth creation uses stable IDs. Firebase CLI imports `.emulator-data` when available and exports on graceful shutdown. Stop it with Ctrl+C, wait for export, then restart to retain data. There is deliberately no production reset endpoint. Password reset in local mode prints a link in the Auth emulator terminal instead of sending an email.

## Commands

To inspect real API responses using the existing cloud demo accounts, run `npm run api:request -- Admin GET /employees`. See [UI → API → Firestore verification](docs/api/firebase-data-flow.md) for writes, document paths and browser Network checks.

| Command                                        | Purpose                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------ |
| `npm run dev:frontend` / `npm run dev:backend` | Independent dev servers                                                  |
| `npm run emulators` / `npm run seed`           | Local services and synthetic fixtures                                    |
| `npm run check:env -w frontend` / `-w backend` | Validate mode-specific configuration                                     |
| `npm run check:db -w backend`                  | Real bounded Firestore read, nonzero exit on failure; no business writes |
| `npm run lint` / `npm run typecheck`           | ESLint and all workspace TypeScript checks                               |
| `npm test`                                     | Business-rule unit tests; no running API needed                          |
| `npm run test:integration`                     | Real Auth + API + Firestore tests; emulators must be running             |
| `npm run test:rules`                           | Deny client reads/writes, including forged Admin claims                  |
| `npm run test:e2e`                             | Chrome browser flows; emulators, seed, API, and Vite must be running     |
| `npm run build`                                | API + production frontend build; rejects emulator mode                   |
| `npm run build:demo`                           | API + local demo frontend build                                          |
| `npm run check:firebase`                       | Read-only project, Admin Auth, Firestore and initialization checks        |
| `npm run check:cloud-api`                      | Cloud demo sign-in, role permissions, reads, profile write/replay and CSV |
| `npm run start -w backend`                     | Start compiled API with backend environment                              |
| `npm run build:cloud -w frontend`              | Cloud frontend build, rejects emulator configuration                     |

Integration tests use **`organizations/hoosoo-tests`**, never the live demo organization. Browser tests add identifiable synthetic QA records to the demo. See [testing](docs/testing/README.md) before running tests against data you want to preserve. Browser screenshots live in `output/playwright/`. Trace archives are ignored because they can contain local session material; do not publish traces or emulator exports.

## Implemented P0 areas

- Firebase email/password login, reset, session restoration; no public registration UI.
- Active membership authorization on every API business request; role, field and direct-team restrictions.
- Admin account provisioning/recovery, role changes, access activation, last-Admin protection.
- Employee profiles, search/filter/paging, transfers, manager-cycle checks, job-change history.
- Department/position management and an organization directory highlighting the current person.
- Server-time check-in/out, daily uniqueness, partial-record status, reasoned HR adjustments and before/after history.
- Whole-day leave requests, work-calendar calculation, overlap prevention, approval/rejection/cancellation, atomic balance ledger and idempotent actions.
- Role-scoped dashboard, employee/attendance/leave/balance reports and filtered CSV exports.
- HR policies, leave types, yearly balance adjustments, account/system settings, audit log and live database status.

See [architecture](docs/architecture/README.md), [permission matrix](docs/architecture/permissions.md), [data model](docs/architecture/data-model.md), [API contract](docs/api/README.md), [demo walkthrough](docs/demo/README.md), and [delivery status](docs/STATUS.md).

## Cloud configuration and deployment boundary

Cloud hosting is **not deployed**. The current Firebase connection status is recorded in [Firebase connection status](docs/firebase-connection.md). The default build now uses Vite production mode and rejects emulator configuration. Use `npm run build:demo` explicitly for emulator builds. A production API also refuses emulator mode.

For a real deployment, explicitly configure a Firebase project, enable email/password Auth, register allowed domains, and deploy the deny-client Firestore rules using an authenticated operator. Frontend `VITE_*` values are public Firebase web configuration, never Admin credentials. Use a separate `frontend/.env.production.local` with `VITE_FIREBASE_MODE=cloud`, a real project ID, real web configuration and the deployed API URL. **Remove `VITE_FIREBASE_AUTH_EMULATOR_URL` from `.env.local`** before cloud builds; Vite reads `.env.local` for all modes. In backend `.env`, set `NODE_ENV=production`, `FIREBASE_MODE=cloud`, the same real project ID and allowed HTTPS origins; remove both emulator host variables. Use Application Default Credentials / workload identity. If a local credential file is necessary, keep it in ignored `backend/.secrets/` and provide `GOOGLE_APPLICATION_CREDENTIALS` as an absolute path. Never put it in frontend or commit it.

The authorized cloud demo Admin and three other roles are initialized. The dedicated `bootstrap:demo-cloud` script is restricted to `hoosoo-37881` and preserves existing records; the regular local demo seed still refuses cloud. Public hosting deployment remains outside this connection task. Before cloud release, review dependency audit output, load/scalability limits, backups, infrastructure TLS, rate-limit/proxy policy, account recovery, and monitoring using the actual deployment environment.

Production routing must send `/api/**` to Express **before** the SPA fallback. Example reverse-proxy contract:

```nginx
location /api/ { proxy_pass http://127.0.0.1:4000; }
location / { root /srv/hoosoo/frontend/dist; try_files $uri $uri/ /index.html; }
```

Vite's dev proxy is not a production reverse proxy. The API returns JSON 404s for unknown API paths. The SPA handles deep-link refreshes only when its host has the fallback above. A cloud API on another origin requires its HTTPS URL in `VITE_API_BASE_URL` and an explicit CORS allowlist. CORS is not an authorization mechanism.

## Technical references

- [Firebase Authentication emulator](https://firebase.google.com/docs/emulator-suite/connect_auth)
- [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Vite configuration and development](https://vite.dev/guide/)
