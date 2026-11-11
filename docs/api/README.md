# API contract

For the live UI-to-Firestore mapping and runnable authenticated route checks, see [Firebase data flow](firebase-data-flow.md).

Development base: `http://127.0.0.1:4000/api/v1`. All routes except `/api/health` and `/api/ready` require `Authorization: Bearer <Firebase ID token>` and active membership. Methods are listed explicitly below. `A` = Admin, `H` = HR, `M` = Manager, `E` = Employee. Team is direct reports in the same current department; own functions are available to every role. The complete field/scope matrix is in `../architecture/permissions.md`.

## Conventions

- JSON request/response, 64 KiB body limit, 300 requests/minute/IP. Reads use `GET`. Writes require `Idempotency-Key` (8–100 letters/digits/underscore/hyphen; a UUID is suitable). Reusing a key with a different route/body returns 409. Keep the key for a network retry of the same operation; generate a new key for a new operation.
- List response `Page<T> = {items: T[], total: number, page: number, pageSize: number}`. Lists use `page=1`, `pageSize=20` by default, maximum 100. Single-organization, bounded server-side search/filtering happens before pagination. Counts are after authorization and filters.
- Allowed query keys: page, pageSize, search (max 100 chars), departmentId, positionId, employeeId, status, startDate, endDate, year (2020–2100), mine (`true`/`false`), approvals (`true`/`false`), kind. Each route uses relevant keys; unknown keys are rejected. Date interval must be ascending and at most 366 days when both endpoints are supplied. IDs: letters, digits, `_`, `-`, max 100. Dates are real `YYYY-MM-DD` values.
- Successful writes return 200 with the confirmed resource. No business DELETE endpoint exists. PATCH employee/profile/catalog/type updates use the documented field set; state transitions use dedicated actions.
- Common errors for every authenticated endpoint: 400 validation, 401 missing/invalid token, 403 inactive membership or action forbidden, 404 missing/out-of-scope target, 409 business conflict/idempotency mismatch, 429 rate limit, 500 sanitized internal error, 503 dependency failure. Errors contain `error: {code,message,fieldErrors,requestId}`. Do not infer successful persistence from a timeout; retry using the same key.

Example header usage:

```sh
curl http://127.0.0.1:4000/api/v1/me -H "Authorization: Bearer $ID_TOKEN"
```

`ID_TOKEN` is obtained by the Firebase web SDK after login. Do not paste it into documentation, logs or chat.

## Input shapes

```json
{
  "EmployeeInput": {
    "employeeCode": "HS100",
    "name": "Nhân viên demo",
    "email": "demo100@hoosoo.demo",
    "phone": "",
    "address": "",
    "departmentId": "dept3",
    "positionId": "pos3",
    "managerId": "staff11",
    "hireDate": "2026-11-10",
    "status": "active"
  },
  "ProfileInput": { "phone": "0900000100", "address": "Địa chỉ minh họa" },
  "CatalogInput": { "name": "Tên danh mục", "description": "Mô tả" },
  "LeaveInput": {
    "leaveTypeId": "annual",
    "startDate": "2026-11-23",
    "endDate": "2026-11-24",
    "reason": "Việc cá nhân minh họa"
  },
  "LeaveTypeInput": {
    "name": "Nghỉ phép năm",
    "deductsBalance": true,
    "active": true
  },
  "AccountInput": {
    "employeeId": "staff13",
    "role": "Employee",
    "password": "ExampleOnly!ChangeMe"
  },
  "BalanceAdjustment": {
    "year": 2026,
    "amount": 1,
    "reason": "Điều chỉnh hạn mức demo"
  },
  "AttendanceAdjustment": {
    "checkIn": "2026-11-09T08:00:00+07:00",
    "checkOut": "2026-11-09T18:00:00+07:00",
    "reason": "Đối chiếu thông tin chấm công"
  },
  "ScheduleInput": {
    "schedule": {
      "start": "08:00",
      "end": "18:00",
      "breakStart": "12:00",
      "breakEnd": "13:00",
      "lateGraceMinutes": 10,
      "workDays": [1, 2, 3, 4, 5],
      "holidays": ["2026-09-02"]
    },
    "annualAllowance": 12
  }
}
```

Employee create and full update accept EmployeeInput only. Work email is immutable after account linkage. Status is probation/active/terminated. Contact defaults to empty strings. Leave reason minimum 5 characters; rejection, approved cancellation, attendance and balance adjustment reasons also minimum 5. Passwords are 10–100 characters. Schedule uses a daytime shift and one break fully inside it. Check-out may be null; adjustments must remain within the record's Vietnam date, not in the future, and check-out cannot precede check-in. Balance amount is a nonzero integer, -365 to 365.

## Endpoint reference

Every example below is a method and relative path (prepend the base URL); JSON after `body:` is the request body. `none` means no body. Common errors above apply in addition to the listed business errors. DTO definitions are exported from `shared/src/index.ts`; fields and ledger semantics are documented in the data model.

### GET `/me`

Session identity. **Roles:** A/H/M/E. **Scope:** Own.

- Input: none.
- Response: Me: actor, redacted employee, companyName.
- Business errors: 403 access disabled.
- Example: `GET /me`.

### PATCH `/me/profile`

Edit personal contact. **Roles:** A/H/M/E. **Scope:** Own.

- Input: ProfileInput.
- Response: EmployeeView.
- Business errors: 400 unknown/invalid field.
- Example: `PATCH /me/profile body: {"phone":"0900000100","address":"Địa chỉ demo"}`.

### GET `/users`

Accounts and recoverable jobs. **Roles:** A. **Scope:** Organization.

- Input: none.
- Response: {items: Membership[], jobs: AccountJob[]}.
- Business errors: 403 role.
- Example: `GET /users`.

### POST `/users`

Provision/link or recover account. **Roles:** A. **Scope:** Selected unlinked active employee.

- Input: AccountInput.
- Response: {uid,employeeId,role,status}.
- Business errors: 409 EMAIL_EXISTS / ACCOUNT_LINKED / ACCOUNT_PROVISIONING; 503 PROVISIONING_INCOMPLETE.
- Example: `POST /users body: AccountInput`.

### PATCH `/users/:uid/role`

Change role. **Roles:** A. **Scope:** Organization.

- Input: {role: Admin|HR|Manager|Employee}.
- Response: Membership.
- Business errors: 409 LAST_ADMIN.
- Example: `PATCH /users/hs-employee/role body: {"role":"Employee"}`.

### PATCH `/users/:uid/status`

Activate/disable API access. **Roles:** A. **Scope:** Organization.

- Input: {active: boolean}.
- Response: Membership.
- Business errors: 409 LAST_ADMIN / EMPLOYMENT_ENDED.
- Example: `PATCH /users/hs-employee/status body: {"active":false}`.

### GET `/dashboard`

Role-scoped aggregates. **Roles:** A/H/M/E. **Scope:** All/Team/Own.

- Input: startDate,endDate.
- Response: scope,asOf,counts,departments,recentLeaves,today,balances.
- Business errors: 400 date range.
- Example: `GET /dashboard?startDate=2026-11-01&endDate=2026-11-30`.

### GET `/employees`

Search/paginate work profiles. **Roles:** A/H/M. **Scope:** All/Team.

- Input: search,departmentId,positionId,status,page,pageSize.
- Response: Page<EmployeeView>.
- Business errors: 400 filters.
- Example: `GET /employees?search=Khoa&page=1&pageSize=20`.

### POST `/employees`

Create employee. **Roles:** A/H. **Scope:** Organization.

- Input: EmployeeInput.
- Response: EmployeeView.
- Business errors: 409 EMPLOYEE_CODE_EXISTS / MANAGER_CYCLE; 400 INVALID_REFERENCE.
- Example: `POST /employees body: EmployeeInput`.

### GET `/employees/:employeeId`

Profile details. **Roles:** A/H/M/E. **Scope:** All/Team/Own.

- Input: none.
- Response: EmployeeView; contacts redacted for Manager.
- Business errors: 404 object scope.
- Example: `GET /employees/staff12`.

### PATCH `/employees/:employeeId`

Full editable employee update. **Roles:** A/H. **Scope:** Organization.

- Input: EmployeeInput.
- Response: EmployeeView.
- Business errors: 409 duplicate/cycle/manager has reports/linked email immutable.
- Example: `PATCH /employees/staff13 body: EmployeeInput`.

### PATCH `/employees/:employeeId/status`

Employment status transition. **Roles:** A/H. **Scope:** Organization.

- Input: {status: probation|active|terminated}.
- Response: EmployeeView.
- Business errors: 409 LAST_ADMIN / MANAGER_HAS_REPORTS.
- Example: `PATCH /employees/staff13/status body: {"status":"terminated"}`.

### GET `/employees/:employeeId/history`

Work history only. **Roles:** A/H/M/E. **Scope:** All/Team/Own.

- Input: page,pageSize.
- Response: Page<Audit> filtered to employee work changes.
- Business errors: 404 object scope.
- Example: `GET /employees/staff12/history`.

### GET `/departments`

Read bounded work catalog. **Roles:** A/H/M/E. **Scope:** Directory.

- Input: page,pageSize.
- Response: Page<Catalog + employeeCount>.
- Business errors: 400 paging.
- Example: `GET /departments?pageSize=100`.

### POST `/departments`

Create catalog item. **Roles:** A/H. **Scope:** Organization.

- Input: CatalogInput.
- Response: Catalog.
- Business errors: 409 NAME_EXISTS.
- Example: `POST /departments body: {"name":"Danh mục demo","description":"Mô tả"}`.

### PATCH `/departments/:id`

Edit catalog item. **Roles:** A/H. **Scope:** Organization.

- Input: CatalogInput.
- Response: Catalog.
- Business errors: 409 NAME_EXISTS.
- Example: `PATCH /departments/demo-id body: {"name":"Tên mới","description":"Mô tả"}`.

### PATCH `/departments/:id/status`

Activate/deactivate item. **Roles:** A/H. **Scope:** Organization.

- Input: {active:boolean}.
- Response: Catalog.
- Business errors: 409 CATALOG_IN_USE.
- Example: `PATCH /departments/demo-id/status body: {"active":false}`.

### GET `/positions`

Read bounded work catalog. **Roles:** A/H/M/E. **Scope:** Directory.

- Input: page,pageSize.
- Response: Page<Catalog + employeeCount>.
- Business errors: 400 paging.
- Example: `GET /positions?pageSize=100`.

### POST `/positions`

Create catalog item. **Roles:** A/H. **Scope:** Organization.

- Input: CatalogInput.
- Response: Catalog.
- Business errors: 409 NAME_EXISTS.
- Example: `POST /positions body: {"name":"Danh mục demo","description":"Mô tả"}`.

### PATCH `/positions/:id`

Edit catalog item. **Roles:** A/H. **Scope:** Organization.

- Input: CatalogInput.
- Response: Catalog.
- Business errors: 409 NAME_EXISTS.
- Example: `PATCH /positions/demo-id body: {"name":"Tên mới","description":"Mô tả"}`.

### PATCH `/positions/:id/status`

Activate/deactivate item. **Roles:** A/H. **Scope:** Organization.

- Input: {active:boolean}.
- Response: Catalog.
- Business errors: 409 CATALOG_IN_USE.
- Example: `PATCH /positions/demo-id/status body: {"active":false}`.

### GET `/organization/tree`

Work directory / current-position marker. **Roles:** A/H/M/E. **Scope:** Public work fields in organization.

- Input: none.
- Response: companyName + departments with redacted employees.
- Business errors: 503 setup.
- Example: `GET /organization/tree`.

### GET `/attendance`

Attendance history and metrics. **Roles:** A/H/M/E. **Scope:** All/Team/Own.

- Input: date interval,departmentId,employeeId,status,mine,page.
- Response: Page<AttendanceView>.
- Business errors: 400 filter range.
- Example: `GET /attendance?mine=true&startDate=2026-11-01&endDate=2026-11-30`.

### GET `/attendance/today`

Current person today. **Roles:** A/H/M/E. **Scope:** Own.

- Input: none.
- Response: AttendanceView or null.
- Business errors: 403 disabled.
- Example: `GET /attendance/today`.

### POST `/attendance/check-in`

Record backend time. **Roles:** A/H/M/E. **Scope:** Own.

- Input: {} (no client timestamp).
- Response: Attendance.
- Business errors: 409 CHECK_IN_REQUIRED (checkout); duplicate returns existing.
- Example: `POST /attendance/check-in body: {}`.

### POST `/attendance/check-out`

Record backend time. **Roles:** A/H/M/E. **Scope:** Own.

- Input: {} (no client timestamp).
- Response: Attendance.
- Business errors: 409 CHECK_IN_REQUIRED (checkout); duplicate returns existing.
- Example: `POST /attendance/check-out body: {}`.

### PATCH `/attendance/:recordId/adjustment`

Reasoned correction and history. **Roles:** A/H. **Scope:** Organization.

- Input: AttendanceAdjustment.
- Response: Attendance.
- Business errors: 400 SAME_DAY_REQUIRED / INVALID_TIME_ORDER / FUTURE_ATTENDANCE.
- Example: `PATCH /attendance/staff12_2026-11-09/adjustment body: AttendanceAdjustment`.

### GET `/leave-types`

Leave policy catalog. **Roles:** A/H/M/E. **Scope:** Organization.

- Input: page,pageSize.
- Response: Page<LeaveType>.
- Business errors: 400 paging.
- Example: `GET /leave-types?pageSize=100`.

### POST `/leave-types`

Create leave type. **Roles:** A/H. **Scope:** Organization.

- Input: LeaveTypeInput.
- Response: LeaveType.
- Business errors: 400 input.
- Example: `POST /leave-types body: LeaveTypeInput`.

### PATCH `/leave-types/:id`

Edit future leave policy. **Roles:** A/H. **Scope:** Organization.

- Input: LeaveTypeInput.
- Response: LeaveType; existing request snapshots unchanged.
- Business errors: 404 missing type.
- Example: `PATCH /leave-types/annual body: LeaveTypeInput`.

### GET `/leave-requests`

Scoped request list. **Roles:** A/H/M/E. **Scope:** All/Team/Own; approvals excludes own.

- Input: status,dates,employeeId,departmentId,mine,approvals,page.
- Response: Page<LeaveView> with canApprove/canCancel.
- Business errors: 400 filters.
- Example: `GET /leave-requests?approvals=true&status=pending`.

### POST `/leave-requests`

Create pending request. **Roles:** A/H/M/E. **Scope:** Own.

- Input: LeaveInput.
- Response: LeaveRequest with snapshot and history.
- Business errors: 409 LEAVE_OVERLAP / NO_ELIGIBLE_APPROVER; 400 CROSS_YEAR_LEAVE / NO_WORKING_DAYS.
- Example: `POST /leave-requests body: LeaveInput`.

### GET `/leave-requests/:id`

Request details. **Roles:** A/H/M/E. **Scope:** All/Team/Own.

- Input: none.
- Response: LeaveView.
- Business errors: 404 object scope.
- Example: `GET /leave-requests/request-id`.

### POST `/leave-requests/:id/approve`

Atomic approve/debit. **Roles:** A/H/M. **Scope:** Eligible others only.

- Input: {reason?:string}.
- Response: LeaveRequest.
- Business errors: 403 SELF_APPROVAL_FORBIDDEN; 409 LEAVE_BALANCE_INSUFFICIENT / INVALID_LEAVE_STATE.
- Example: `POST /leave-requests/request-id/approve body: {}`.

### POST `/leave-requests/:id/reject`

Reject pending request. **Roles:** A/H/M. **Scope:** Eligible others only.

- Input: {reason:string, min 5}.
- Response: LeaveRequest.
- Business errors: 403 self/scope; 409 invalid state.
- Example: `POST /leave-requests/request-id/reject body: {"reason":"Cần bàn giao công việc"}`.

### POST `/leave-requests/:id/cancel`

Cancel, atomically refund if approved. **Roles:** A/H/E/M. **Scope:** Own pending or HR/Admin all; approved HR/Admin only.

- Input: {reason?:string}; required for approved.
- Response: LeaveRequest.
- Business errors: 403 role; 409 invalid state; 400 reason.
- Example: `POST /leave-requests/request-id/cancel body: {"reason":"Thay đổi lịch cá nhân"}`.

### GET `/leave-balances`

Balance and ledger history. **Roles:** A/H/M/E. **Scope:** All/Team/Own.

- Input: year,employeeId,departmentId,mine,page.
- Response: Page<BalanceView>.
- Business errors: 400 year.
- Example: `GET /leave-balances?mine=true&year=2026`.

### POST `/leave-balances/:employeeId/adjustments`

Change yearly allowance. **Roles:** A/H. **Scope:** Organization.

- Input: BalanceAdjustment.
- Response: Balance.
- Business errors: 409 BALANCE_BELOW_USED.
- Example: `POST /leave-balances/staff12/adjustments body: BalanceAdjustment`.

### GET `/reports/employees`

Report rows and total. **Roles:** A/H/M. **Scope:** All/Team.

- Input: Relevant list filters + paging/year.
- Response: Page<corresponding DTO> + summary.total + exportScope.
- Business errors: 400 range/filter.
- Example: `GET /reports/employees?page=1&pageSize=20`.

### GET `/reports/attendance`

Report rows and total. **Roles:** A/H/M. **Scope:** All/Team.

- Input: Relevant list filters + paging/year.
- Response: Page<corresponding DTO> + summary.total + exportScope.
- Business errors: 400 range/filter.
- Example: `GET /reports/attendance?page=1&pageSize=20`.

### GET `/reports/leave`

Report rows and total. **Roles:** A/H/M. **Scope:** All/Team.

- Input: Relevant list filters + paging/year.
- Response: Page<corresponding DTO> + summary.total + exportScope.
- Business errors: 400 range/filter.
- Example: `GET /reports/leave?page=1&pageSize=20`.

### GET `/reports/balances`

Report rows and total. **Roles:** A/H/M. **Scope:** All/Team.

- Input: Relevant list filters + paging/year.
- Response: Page<corresponding DTO> + summary.total + exportScope.
- Business errors: 400 range/filter.
- Example: `GET /reports/balances?page=1&pageSize=20`.

### GET `/reports/export`

Download all filtered rows. **Roles:** A/H/M. **Scope:** All/Team.

- Input: kind=employees|attendance|leave|balances + relevant filters.
- Response: UTF-8 BOM CSV, Content-Disposition attachment.
- Business errors: 400 EXPORT_TOO_LARGE (>5000).
- Example: `GET /reports/export?kind=attendance&startDate=2026-11-01&endDate=2026-11-30`.

### GET `/settings`

Read policy. **Roles:** A/H/M/E. **Scope:** Organization.

- Input: none.
- Response: Settings.
- Business errors: 503 SETUP_REQUIRED.
- Example: `GET /settings`.

### PATCH `/settings`

Change HR policy/company name. **Roles:** A/H. **Scope:** companyName A-only, schedule/annualAllowance A/H.

- Input: ScheduleInput and/or {companyName:string}.
- Response: Settings.
- Business errors: 403 field permission; 400 invalid daytime shift.
- Example: `PATCH /settings body: ScheduleInput`.

### GET `/audit-logs`

Read immutable operation history. **Roles:** A. **Scope:** Organization.

- Input: search,startDate,endDate,page.
- Response: Page<Audit>.
- Business errors: 403 role.
- Example: `GET /audit-logs?search=leave.approve`.

### GET `/system/status`

Actual database read status. **Roles:** A. **Scope:** System.

- Input: none.
- Response: {status,api,firestore,mode,checkedAt,latencyMs}.
- Business errors: 503 dependency; 403 role.
- Example: `GET /system/status`.

### GET `/api/v1/events`

Authenticated live-update stream for all active roles. Uses `Authorization: Bearer <Firebase ID token>` (never a token query parameter). Returns `text/event-stream`, not JSON. `changed` contains only an opaque organization version; clients refetch their authorized API queries. `revalidate` asks the client to refresh its access/data and precedes stream closure after a dependency/access failure. No business records are included. Reconnection sends the initial snapshot so missed changes are recovered. The API closes the stream on disconnect, token expiry, or after five minutes. Clients must reconnect with their current token. The terminal `api:request` JSON helper is for ordinary routes, not this persistent stream.

The backend's Firestore snapshot listener observes committed organization revisions, updated atomically with API writes. See [live data flow](firebase-data-flow.md) for synchronization and reverse-proxy requirements.

## Infrastructure routes (outside v1)

- `GET /api/health`: public, no input, 200 `{status:"ok",process:"alive",checkedAt}`. Process liveness only; never claims Firestore connectivity. Example: `GET http://127.0.0.1:4000/api/health`.
- `GET /api/ready`: public, no input; performs a bounded Firestore read; 200 `{status:"ok",checkedAt}` even when the organization document does not exist, or structured 503 on failure/timeout. Does not write business data. Example: `GET http://127.0.0.1:4000/api/ready`.

Unknown API paths return JSON errors, not SPA HTML.
