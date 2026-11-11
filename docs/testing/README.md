# Verification guide

## Isolation

- Unit tests exercise domain invariants with in-memory fixtures; they do not claim database behavior.
- Integration tests use actual local Firebase Auth and Firestore, with `NODE_ENV=test` selecting `organizations/hoosoo-tests`. The suite refuses other modes/organizations, clears only that test organization before/after, and uses prefixed test Auth accounts. It starts its own Express server on an ephemeral loopback port.
- Rules tests exercise unauthenticated, Employee and forged Admin-claim client access against deny-all business rules. They do not clear demo data.
- Browser tests use the running demo app, real local accounts and persisted data. They add synthetic QA employees/accounts and leave/attendance history. Run on the local demonstration dataset. They do not touch cloud. Successful leave flows end by cancelling the approved test request via HR; a failed browser run may leave a visible test request for HR to resolve.
- Captured trace files can contain local Auth material and are ignored. Keep only deliberate screenshots for a report.

## Commands and acceptance coverage

```sh
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run test:rules
npm run test:e2e
npm run build:demo
npm run check:env -w frontend
npm run check:env -w backend
npm run check:db -w backend
```

The domain suite covers Vietnam dates, weekends/holidays, break overlap, shift-clipped payable time, missing checkout, attendance duplication, leave dates/overlap/self-approval/state transitions, snapshot policy, approval-time balance rechecks, refunds, private-field redaction, transfer scope, cycle/duplicate/reference checks, last Admin, CSV injection and environment conflicts.

For the cloud-configured workspace, use `npm run build` for a production frontend bundle and `npm run check:firebase` for read-only live diagnostics. Vitest overrides cloud `.env` values with `demo-hoosoo`; business browser tests require the emulator-mode login label and stop before signing in if the running frontend uses cloud.

The integration suite covers token verification, role and object authorization, tampered subjects, disable with an existing token, last Admin, allowed transition routes, duplicate attendance, real transaction contention for simultaneous approvals, exactly-once refunds, idempotency payload mismatch, employee uniqueness/transfer, scoped CSV, health/ready/JSON404, and deterministic account linking.

Browser scenarios cover session restoration/deep links, Admin employee/account creation with persistence, scoped menu access, real CSV download, live system check, desktop/mobile navigation, Employee attendance, cross-account approval/cancellation, and form preservation during simulated network failure. Tests are representative and do not prove every visual/browser/accessibility combination.

## Dependency outage checks

Use only the locally owned emulator/API processes. Stop the API and confirm the UI shows a connection error rather than success. Stop Firestore and call `/api/ready`; it should return 503 within the configured timeout while `/api/health` remains 200. `check:db` should exit nonzero. Restart and recheck. Do not stop a shared/remote service for testing. Do not interpret emulator success as cloud verification.

## Manual review targets

Keyboard focus, labels, native-dialog focus trapping, narrow-screen table scrolling and navigation, field errors, empty and filtered-empty states. Account-recovery failure cases involving a Firebase cloud outage remain a deployment validation item. Capacity, multi-instance contention and long-lived retention need a separate performance/operational review before scaling.

Final observed results and known gaps are recorded in `../STATUS.md`.

The isolated outage check is also available as `node scripts/check-outage.mjs` after building the backend. It starts a short-lived API on port 4002 pointing to an intentionally unavailable loopback Firestore port (18080), checks time-bounded failure responses, and stops that API without stopping the demo services.
