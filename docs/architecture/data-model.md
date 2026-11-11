# Data model

Root `organizations/hoosoo` is the single-organization coordination document. All collections below are nested under it. Tests use `organizations/hoosoo-tests`. Document IDs, employee codes and Auth UIDs are distinct. Each persisted document contains `id`, server-generated `createdAt` and `updatedAt` Firestore timestamps. API serialization uses ISO-8601 strings. Attendance/check-in and transition-history instants use backend-generated ISO timestamps. Business dates are `YYYY-MM-DD` in Asia/Ho_Chi_Minh.

| Collection               | Key                                 | Main fields / invariants                                                                   | Query bound |
| ------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------ | -------- |
| employees                | UUID or stable seed ID              | unique case-insensitive employeeCode; work/contact fields; managerId; status; optional uid | 100      |
| memberships              | Firebase UID                        | employeeId, email, role, active, orgId; one linked account per employee                    | 150      |
| departments              | UUID                                | name, description, active                                                                  | 25       |
| positions                | UUID                                | name, description, active                                                                  | 50       |
| attendanceRecords        | employeeId_YYYY-MM-DD               | checkIn, nullable checkOut, calendar snapshot, adjustment history                          | 10,000   |
| leaveTypes               | UUID                                | name, active, deductsBalance                                                               | 20       |
| leaveRequests            | UUID                                | employeeId, date interval, workDates, days, typeName/deduction snapshot, status, history   | 3,000    |
| leaveBalances            | employeeId_year                     | allowance, used; available derived, pending derived separately                             | 1,000    |
| leaveBalanceTransactions | UUID; stable initial allocation key | year, employeeId, amount, kind, actorId, reason, optional requestId                        | 5,000    |
| auditLogs                | UUID                                | actorId, action, targetId, reason, sanitized changes                                       | 10,000   |
| settings                 | main                                | companyName, schedule, annualAllowance                                                     | 1        |
| accountJobs              | deterministic Auth UID              | employeeId, email, role, pending/complete/failed, sanitized error                          | 150      |
| receipts                 | SHA256(actor UID + idempotency key) | hash of action/body, result, actorId                                                       | 10,000   |

Exceeding a query bound fails explicitly. Mutations now load operation-specific records instead of the whole organization: audit/ledger append operations and point receipt lookups do not scan or enforce a global count on historical collections. Catalog and employee uniqueness/reference operations still load their bounded collections. The parent organization document coordinates transactions and carries `revision`, `updatedAt` and per-collection `collectionVersions` for targeted live invalidation. There is no hard-delete business API or automatic retention deletion. A long-running deployment needs reviewed archival, receipt-retention and cursor pagination policies; see [free-tier optimization](../firebase-free-tier.md). Daily seed history is about 250 attendance records; repeated seed preserves state instead of multiplying it.

Balance allocation is persisted on first relevant business write. Before allocation, the displayed default allowance comes from current settings; once allocated it is stable and subsequent changes require ledger adjustments. Ledger kinds: allocation (+allowance), adjustment (signed delta), debit (-approved days), refund (+cancelled approved days). The ledger explains the account's available balance. Non-deducting leave does not debit or refund. Configuration and type changes do not recalculate existing requests/attendance.

Audit contains only relevant work-field changes or operation metadata. Personal contact updates record changed field names rather than full private values. Passwords, tokens, credentials and complete private profiles are never audit fields. Account-job and receipt collections are inaccessible to client SDKs, like every other collection. Admin SDK bypasses Firestore rules, so API authorization must remain in place.
