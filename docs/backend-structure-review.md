# Backend structure review

Reviewed on 2026-11-11. This change organizes the backend source and updates module imports. The navigation guide is [backend/README.md](../backend/README.md).

## Changes

- Group HTTP routes, services and query functions by business area in `backend/src/modules/`.
- Move dashboard registration into its own module while preserving the flattened API registration order.
- Separate organization catalog operations from employee operations and last-Admin protection into the accounts policy.
- Separate leave requests, leave types and balance operations into named files within the leave module.
- Move shared authorization, command orchestration, scoped write read plans, audit and query helpers into `common/`.
- Put Firestore persistence, quota handling and the shared live listener in `database/`; put usage accounting in `observability/`.
- Put synthetic bootstrap helpers under `scripts/lib/`. Existing script commands and test entry points remain unchanged.
- Update script imports, test imports, dynamic imports and Vitest mock paths for the new locations.

## Verification

| Check | Observed result |
| --- | --- |
| Before/after Express router inventory | All 51 method/path pairs and their order match, including health/readiness |
| Source comparison | 60 implementation fragments and the extracted dashboard handler match after ignoring formatting and normalizing relocated module paths |
| Protected configuration | Backend environment, Firebase initialization, npm scripts, test configuration, rules/indexes/emulator configuration and frontend API client match their pre-change checksums |
| `npm test` | 37 passed |
| `npm run typecheck` | All workspaces passed |
| `npm run lint` | Passed |
| `npm run build` | Backend and frontend passed; existing Zod comment-annotation warnings do not block the build |
| Auth/API/Firestore integration | 19 passed in isolated `demo-hoosoo` emulators |
| Firestore rules | 1 passed, including denied reads/writes for unauthenticated and forged Admin clients |
| Backend environment validation | Cloud mode, project `hoosoo-37881` |
| Running API and Vite proxy | `/api/health` returned HTTP 200 through ports 4000 and 5173 after restarting the API |

Integration coverage includes department persistence and organization-tree results, role and field restrictions, attendance duplication, concurrent leave approvals/refunds, idempotency, account-link recovery, SSE changes/access revocation, and bounded reads with large history and four concurrent roles.

Machine-readable comparison results and the endpoint inventory are saved in [output/backend/structure-validation.json](../output/backend/structure-validation.json). A source-only pre-change backup was kept at `/tmp/hoosoo-backend-structure-before`; it contains no copied credential file. The historical delivery checksum manifest was left as the original release record.

## Validation boundary

Normal application startup continues to read the existing cloud `.env` and uses Firebase project `hoosoo-37881`. Emulators were started only for isolated tests and were stopped afterward. No cloud business records, Firebase rules, indexes, credentials or collections were changed during this refactor. Cloud business reads/writes and quota recovery were not retested; `/api/health` confirms process liveness, not Firestore readiness.
