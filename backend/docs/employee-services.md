# Equipment, learning and offboarding

## Routes and records

All business paths below require a Firebase bearer token and active organization membership. All writes require `Idempotency-Key`. Updates/actions require the current positive record `version`; creation uses `version: 0`.

| Method | Path                                                                             | Purpose                                                                           |
| ------ | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| GET    | `/api/v1/employee-services?section=assets\|training\|offboarding&scope=my\|team` | Scoped workspace with capabilities, available people and approved source requests |
| POST   | `/api/v1/employee-services`                                                      | Create assignment, enrollment or offboarding plan                                 |
| PATCH  | `/api/v1/employee-services/:id`                                                  | Edit an eligible open record; owner/source/asset code are immutable               |
| POST   | `/:id/acknowledge`, `/:id/request-return`, `/:id/receive-return`                 | Equipment receipt and return                                                      |
| POST   | `/:id/submit-learning`, `/:id/accept-learning`, `/:id/revise-learning`           | Outcome submission, recognition and revision                                      |
| POST   | `/:id/tasks`, `/:id/task`                                                        | Add an owned handover task; confirm/reopen a task                                 |
| POST   | `/:id/cancel`, `/:id/complete`                                                   | Cancel an eligible plan; finalize cleared offboarding                             |

Short action paths share `/api/v1/employee-services`. Request schemas are in `shared/src/employee-services.ts`. Unknown fields, invalid calendar dates, inverted ranges and non-HTTPS certificate links are rejected. Certificate links are displayed as external links; the server does not fetch them.

Records are stored at `organizations/{organizationId}/employeeServices/{id}`. Each contains section, employeeId, title, dates, status, version, sourceRequestId, section-specific fields, tasks and event history. A distinct record per issuance preserves previous assignments when an asset is returned and reissued.

## Permissions

| Operation                            | Employee         | Scoped supervisor              | HR/Admin                                           |
| ------------------------------------ | ---------------- | ------------------------------ | -------------------------------------------------- |
| View                                 | Own              | Subordinates in assigned scope | Authorized subordinates; own through personal view |
| Create/edit/cancel                   | No               | No                             | Yes, subordinate only; no self-management          |
| Acknowledge equipment/request return | Own              | No                             | Own personal assignment only                       |
| Confirm equipment return             | No               | No                             | Authorized subordinate                             |
| Submit learning result               | Own              | No                             | Own personal enrollment only                       |
| Recognize/revise learning            | No self-approval | Authorized subordinate         | Authorized subordinate                             |
| Employee-owned handover item         | Owner only       | No                             | No override                                        |
| Manager-owned handover item          | No               | Assigned direct manager        | Authorized HR/Admin fallback                       |
| HR-owned task and final exit         | No               | No                             | Authorized subordinate                             |

HR cannot process peers, Director or Admin. Manager/deputy/team roles reuse the project's existing role rank and department/report scope. Admin offboarding is blocked until authority is transferred. Capabilities in the UI are advisory; every command rechecks server authorization, state and version. Idempotency replay also reloads the current target and checks current permission/task ownership.

## State constraints

- Equipment and training enrollment require an active linked account at creation so the employee can complete receipt/outcome steps. For offboarding a profile without an active account, the initial work-handover task is assigned explicitly to HR for verification against the handover record. Existing employee-owned tasks are not silently reassigned.
- Equipment: `issued → in_use → return_requested → returned`. HR can also receive equipment directly from `in_use`. Only an unacknowledged issuance can be cancelled. A non-returned/non-cancelled asset code cannot be issued twice, including across departments.
- Training: `in_progress → completion_requested → completed`, or return to `in_progress` with revision feedback. No outcome before the start date. Recognition is a human review, not an inferred score.
- Offboarding: `in_progress → completed` only on/after the last working day, after all assigned tasks, asset returns and active direct-report reassignment. Finalization changes employee status, linked memberships and active contracts in one transaction. It does not calculate or pay a final salary. Direct profile termination is additionally blocked while assets remain outstanding.
- Source requests must be approved, belong to the same employee and match the section. Equipment assignments cannot exceed approved quantity; one training request creates one enrollment. Cancelled records release that fulfillment slot. Fully fulfilled sources disappear from creation choices.
- No hard-delete endpoint. Reasons and actor history are retained. Handover plans have at most 30 tasks.

## Read and mutation policy

- Personal lists query only the signed-in employee ID. Team lists derive authorized subordinate IDs from fresh membership/employee access; queries use `employeeId in (...)` chunks of at most 30.
- Related sections reuse the same scoped record selection/cache. HR source requests reuse scoped employee IDs. Managers do not load request-picker data.
- Writes read the target document/employee and linked access, employee-specific service records, optional source request ID, and the specific asset code for uniqueness. Offboarding completion additionally reads direct reports, memberships, organization IDs and employee contracts. No audit/history collection scan is needed for these commands.
- Shared transaction receipts prevent duplicate writes; version checks reject stale forms. Atomic writes update collection versions for existing SSE/cache invalidation.
- UI filters/paging/export run over the returned scoped workspace. Capacity is 3,000 service records in the existing store policy; this is a bounded thesis-scale workspace, not an unlimited cursor API. Large installations should add server cursors and archives before raising capacity.
- No polling interval, new snapshot listener, scheduled sweep or login-time service prefetch is added. A production revocation check contacts Firebase Auth; it is separate from Firestore reads.

## Verification

Domain tests cover validation, lifecycle, role/scope, source quantity, duplicate assets, version/replay, task owners and offboarding guards. HTTP tests exercise the real Express routes and command read plans against the isolated memory adapter. They do not establish deployed Firestore rules/IAM or cloud persistence; those need an explicitly approved cloud smoke test.
