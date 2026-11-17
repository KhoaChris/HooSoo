# Request expansion and Admin compensation policy

## Request catalog

`POST /internal-requests` now accepts `equipment`, `training`, `expense_reimbursement` and `benefit_support` alongside the four original types. All types retain the existing versioned manager then HR/Admin approval flow, scope/rank restrictions, self-approval prohibition, history, cancellation and duplicate-range guard.

New fields are `resource`, `quantity`, `amount` (integer VND, nullable), and `reference`. Equipment requires a resource and a positive quantity. Training and benefit support require a resource and accept an optional budget. Reimbursements require an amount and receipt reference/link. Reference text is displayed as text, never HTML. These are approval records, not bank transfers, payroll adjustments, asset inventories or course bookings. Approval does not claim that payment or fulfillment occurred.

Only business trips and remote work require a work location, working dates and no-leave checks. Attendance correction retains its original validation and atomic attendance effect. New fields have schema defaults and optional persisted types to keep existing records readable. No migration or polling is required.

## Admin salary band

- `GET /compensation/admin-band`: Admin only; current band, immutable revision snapshots, and a suggestion from the requesting Admin's current published salary, if one exists. Probation pay is omitted from that suggestion.
- `POST /compensation/admin-band`: Admin only; accepts a salary package, reason and expected version. Version zero creates the band. Publishing applies it immediately to every Admin, including future Admin accounts. No default amount is invented.
- `GET /compensation?scope=my`: includes `adminBand` only for Admin. The band is authoritative for their current compensation display. Pre-band personal records remain available as historical records. Ordinary staff salaries keep their existing authorization and draft/publish lifecycle.

Protected collection `compensationBands` stores the head document `Admin` and immutable `Admin-vN` snapshots. Each mutation reads only the head, checks its version, and writes the head and new snapshot atomically using the existing transaction/idempotency infrastructure. Replay rechecks current Admin authority. Generic audit records contain the revision, not salary values or private reasons. Snapshot records preserve the complete package, author, time and reason.

Personal compensation reads one band document for Admin only; the band history is fetched when configuration opens. Non-Admin reads/writes are rejected before any band or salary reads. Existing cache/SSE collection invalidation covers band changes; no interval, subscription to Firestore, startup scan, new scheduled job or automatic migration was added.

## Validation

Local tests cover role denials before sensitive reads, shared-band behavior across Admin accounts, existing salary prefill, stale-version rejection, immutable history, idempotent replay after role changes, all four request types through scoped approvals, malformed amounts/receipts/quantities, duplicate requests and withdrawal. HTTP tests use an in-memory database adapter; they do not establish live cloud persistence.
