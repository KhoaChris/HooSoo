# Delivery status — HooSoo 0.1.0 local

This file records the original local delivery. For the subsequent connection to `hoosoo-37881`, including current verification and remaining setup, see [Firebase connection status](firebase-connection.md).

Verified on 2026-11-10, macOS, Node 25.2.1 / npm 11.6.2 / Java 25.0.1, Chrome, Firebase local Auth and Firestore emulators. Node 24 LTS is the recommended reproducible runtime (`.nvmrc`); the Firebase CLI dependency `superstatic` warns about Node 25. No Firebase cloud project was accessed, provisioned or deployed for the application.

## Delivered

React/TypeScript/Vite frontend, Express/TypeScript backend, shared Zod contracts, npm workspaces and lockfile, emulator configuration, deny-client Firestore rules, index configuration, ignored local env copies plus distributable examples, deterministic demo seed, tests, architecture/permission/data/API docs, Vietnamese demo walkthrough and screenshots from the running app.

The P0 implementation covers the local single-company scope: authentication, account provisioning/recovery, four roles, employee records and work history, departments/positions/directory, server-time attendance and corrections, whole-day leave state machine and balance ledger, scoped dashboards/reports/CSV, HR policies, Admin controls, audit history and a real Firestore status read. Employee contact data is removed from Manager responses at the API boundary.

## Observed verification

| Check                                   | Result                                                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Clean dependency reinstall, `npm ci`    | Passed using the project lockfile and a separate npm cache                                                    |
| Workspace TypeScript checks             | Passed                                                                                                        |
| ESLint                                  | Passed                                                                                                        |
| Domain tests                            | 17 passed                                                                                                     |
| Real Auth/Express/Firestore integration | 15 passed                                                                                                     |
| Firestore client rules                  | 1 passed, covering unauthenticated, Employee and forged Admin claims                                          |
| Browser end-to-end scenarios            | 3 passed (Admin creation/export/system/mobile; Employee/Manager/HR leave flow; error preservation/deep links) |
| Backend build                           | Passed                                                                                                        |
| Frontend demo build                     | Passed; route and vendor chunks split                                                                         |
| Frontend/backend environment checks     | Passed in emulator mode                                                                                       |
| `check:db`                              | Real Firestore read passed                                                                                    |
| Isolated unavailable Firestore probe    | `/api/ready` 503 within timeout, `/api/health` 200, `check:db` exit 1                                         |
| Repeated seed                           | Existing business records and accounts preserved                                                              |
| Frontend application source             | No Firestore client read/write imports                                                                        |
| Frontend bundle scan                    | No demo test passwords or private-key material found                                                          |
| Visual review                           | Desktop dashboard, mobile dashboard (390px), organization view inspected                                      |

Integration tests include concurrent approvals against an insufficient shared balance, duplicate debit/refund prevention, disabled membership with an existing token, Auth users without membership, self-approval rejection, team transfer authorization, last Admin, field redaction, receipt replay after privilege loss, and provisioning recovery when the Auth account exists but linking failed. Browser results are representative, not exhaustive cross-browser certification. No external QC approval is claimed.

## Actual limits and outstanding work

- This is a local demonstration, **not a verified production deployment**. Cloud IAM, live email delivery, first-Admin cloud bootstrap, HTTPS hosting, backups, monitoring, real load and real company policies have not been tested.
- P1/P2 (uploads, contracts, import, half-day leave, PDF export, payroll, recruitment, multi-company, multi-level approval, GPS/face recognition, attendance devices) are not implemented and are not advertised as working menu items.
- The conservative repository uses bounded organization snapshots and a shared transaction coordination document. This makes the 25-person demo consistent but has read-cost/contention limits. The hard caps are documented; large-scale indexed queries, finer-grained locks and retention/archival remain future engineering work.
- Manager scope is direct reports in the same department, not an arbitrary management hierarchy. There is one daytime shift, one break, whole-day leave, and no overtime/payroll calculation. A complete attendance record on a configured non-working day has zero demo paid minutes; incomplete records have null duration.
- Fake demo employees initially number 25. Browser tests add clearly marked QA profiles/accounts and audit/leave history, so the tested local dataset can contain additional entries. Failed exploratory test runs can leave test requests for HR review; no real data is involved.
- Dependency audit at delivery: **0 critical, 0 high**; complete development tree has **20 moderate + 1 low**, production dependency tree **6 moderate**. Remaining advisories concern transitive tooling/dependencies including glob/minimatch/rimraf chains. They have not been represented as resolved. Review them before a real release. `@grpc/grpc-js` is explicitly overridden to 1.14.7; Auth/API/rules/browser tests were run with the resulting installed tree. Avoid blind `npm audit fix --force` downgrades.
- Firebase Admin/Google libraries occasionally emit a metadata lookup warning on this machine while initializing emulator access. The emulator read still succeeds; cloud connectivity has not been inferred from it.
- Vite reports removable third-party Zod PURE-comment annotations during build; these did not prevent build. Dev processes should be restarted after reinstalling `node_modules`; this was done before the final browser run.
- Auth-account creation is a recoverable saga across Auth and Firestore. Pending/failed jobs are visible and retriable, not silently abandoned. This is not a distributed atomic transaction.

## Handoff

Version label: `0.1.0-local`. `SOURCE_MANIFEST.sha256` records source file hashes for the packaged snapshot; no remote repository or release was created. The source archive excludes `node_modules`, compiled output, `.env` copies, credentials, emulator exports and browser traces. It includes safe `.env.example` files and selected screenshots. Follow the root README to install, start three local processes, seed if needed and sign in.

Local application processes used for verification are stopped during handoff after exporting emulator data. The original working folder retains its ignored `.env` files and emulator export for a later local restart.
