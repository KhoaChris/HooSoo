# Employee leave submission and manager approval

Verified on 2026-11-12 (Asia/Ho_Chi_Minh) with four tabs in one browser context, real Firebase Auth and Firestore project `hoosoo-37881`. The existing backend stayed on PID 26515 throughout; its source and environment files were checked by SHA-256 before and after and were unchanged.

## Live cloud results

The synthetic Employee submitted one day of annual leave for 2026-11-13. Admin and HR watched their approval lists, while the Manager opened and approved the request through the normal confirmation dialog. The Employee watched the personal leave list and balance during approval.

| Phase | Result | Relevant GETs across the four test tabs |
| --- | --- | --- |
| Employee creates request | All roles saw `pending` within 1.4–2.9 seconds of submit. Available leave stayed at 10; pending increased to 1. | 4: three approval lists and the employee's new detail page. |
| Manager approves | All roles saw `approved` within 1.6–2.2 seconds. Available leave became 9; pending returned to 0. | 5: Admin/HR lists, manager detail, employee list and employee balance. |
| Repeat the original approval request and idempotency key | Same approved result, one approval in history, zero writes and zero change notifications. | 0 refresh GETs. |
| Four tabs idle for 30 seconds | Zero business GETs, zero listener reads and zero additional process document reads after excluding the diagnostic meter. | 0. |
| HR cancels the test request | All roles saw `cancelled` within 1.5–2.0 seconds. Available leave returned to 10. | 5: Admin list, HR/Manager details, employee list and balance. |

Each GET above occurred once per tab/path in its measured phase. There were no unrelated catalog, employee-directory or session refetches in those phases. Every real commit generated one shared Firestore metadata-listener read, independent of the number of browser tabs.

Independent Admin SDK reads confirmed the approved record, manager's history entry and exactly one debit of one day. After HR cancellation, direct Firestore verification confirmed exactly one refund, a zero net balance change, and the restored original allowance/used values. The cancelled QA request and its audit/ledger history remain for traceability:

`organizations/hoosoo/leaveRequests/86814a39-cb91-476c-b0e5-0ee226f637d7`

The existing 41 backend and 11 frontend unit tests also passed. No production source changes were required for the tested workflow to synchronize correctly.

## Read counts and additional optimization

The backend-wide SDK estimate increased by 58 reads during creation and 51 during approval. These include two diagnostic-meter reads per phase and an existing dashboard session's refresh (11 and 9 reads respectively). They are process instrumentation, not Firebase billing totals. The independent persistence probes used another seven document reads outside those counters.

Although the frontend made no duplicate GETs, review found a backend cache-sharing issue: the current actor is inserted first into the request's employee map, so Admin and HR can produce different employee-ID array orders for the same authorized scope. Those arrays become different Firestore query/cache keys, including different chunks above 30 employees.

A prepared patch sorts the already-authorized IDs before constructing read plans. It preserves per-request authorization, Manager/Employee scopes, mutation invalidation and API routes. A separate integration test used the real Firestore SDK against an isolated emulator with 41 employees and 60 leave records:

| Measurement | Existing code | Prepared patch |
| --- | ---: | ---: |
| Extra history reads when HR follows Admin | 60 | 0 |
| History reads for simultaneous Admin and HR requests | 120 | 60 |

These are history-document counts; fresh authorization reads still occur. The regression also verified immediate rejection after HR membership revocation and fresh results after a mutation. The patched copy passed that integration test, the existing 41 backend unit tests, TypeScript checking and targeted ESLint checks.

**Applied to the repository on 2026-11-12.** The API dev server was already stopped when the user authorized application, so no backend process was restarted. The source matches the tested patch, and the backend distribution was rebuilt. The next backend start uses the optimization.

Post-application validation passed: 52 existing unit tests, the new isolated Firestore regression, backend TypeScript checks, targeted ESLint and backend build. A separate read-only check executed the production request-state code against cloud Firestore and confirmed that HR read zero additional leave-history documents after Admin, while retaining two fresh authorization reads. Manager/Employee scope checks passed. This cloud check performed 26 SDK document reads and zero writes; it did not start an HTTP server or repeat the earlier browser flow.

The patch includes its isolated regression test. Run that test separately from other integration files because it resets only the dedicated emulator test organization:

```sh
npx firebase emulators:exec --config firebase/firebase.json --project demo-hoosoo --only firestore 'npm exec -w backend -- vitest run tests/leave-cache.integration.test.ts --testTimeout=30000'
```

## Evidence

- `output/playwright/leave-approval-cloud-review.json`: role-specific network traces, synchronization timings, balance assertions, replay verification and process counters.
- `output/firebase/leave-approval-persistence.json`: independent approved/cancelled Firestore verification.
- `output/firebase/leave-scope-cache-benchmark.json`: isolated before/after query-cache measurements.
- `docs/patches/leave-scope-cache.patch`: applied source change and regression test; reverse-apply preflight verifies application.
- `output/firebase/leave-scope-cache-applied-cloud.json`: read-only cloud verification using the applied production code.
- `output/firebase/leave-scope-cache-application.json`: application status and validation summary.
- `output/playwright/leave-approved-*.png` and `leave-cancelled-*.png`: UI evidence for each role.
