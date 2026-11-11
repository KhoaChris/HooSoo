# Permission matrix

`Own` means membership.employeeId; `Team` means **direct reports in the Manager's current department**, plus own records for read/personal functions. No recursive team expansion. Transfers immediately change scope. `HR` below includes Admin unless explicitly restricted. All subject/organization/actor IDs are derived or checked on the server.

| Resource / action                   | Admin          | HR             | Manager                  | Employee         |
| ----------------------------------- | -------------- | -------------- | ------------------------ | ---------------- |
| Login/me/personal contact edit      | Own            | Own            | Own                      | Own              |
| Dashboard                           | Organization   | Organization   | Team                     | Own              |
| Employee list/search/reports        | All            | All            | Team work fields         | No list endpoint |
| Employee detail/history             | All            | All            | Team work fields/history | Own              |
| Create/update/terminate employee    | Yes            | Yes            | No                       | No               |
| Department/position mutations       | Yes            | Yes            | No                       | No               |
| Organization directory              | Work directory | Work directory | Work directory           | Work directory   |
| Personal check-in/out               | Own            | Own            | Own                      | Own              |
| Attendance list                     | All            | All            | Team                     | Own              |
| Attendance adjustment               | All + reason   | All + reason   | No                       | No               |
| Create leave                        | Own            | Own            | Own                      | Own              |
| Read leave/balance                  | All            | All            | Team                     | Own              |
| Approve/reject leave                | Others only    | Others only    | Team, others only        | No               |
| Cancel pending leave                | All            | All            | Own                      | Own              |
| Cancel approved leave               | All + reason   | All + reason   | No                       | No               |
| Change balance/leave types/calendar | Yes            | Yes            | No                       | No               |
| Change company name                 | Yes            | No             | No                       | No               |
| Accounts/roles/access               | Yes            | No             | No                       | No               |
| Audit log / system status           | Yes            | No             | No                       | No               |
| CSV/report export                   | All            | All            | Team                     | No               |

Directory DTO: employee ID, name, employee code, department grouping, position name, manager name and self marker. No personal phone/address/email is returned by the organization tree. Manager employee DTOs include work email, job/department/status/hire date/manager relationship but exclude phone, address and Auth UID. Own/HR contact DTOs may include phone/address; only Admin gets linked Auth UID in employee responses. No ID-card/bank/payroll fields exist.

Employee self-edit allowlist: phone, address. All other employee edits require HR/Admin. HR settings allowlist: work schedule and initial annual allowance; the company name is Admin-only. Unknown body properties are rejected, not ignored. Read filters only narrow existing scope. Out-of-scope employee/request lookups use 404. Active users may see public work directory relationships without gaining private profile access.

The last active Admin cannot be disabled, demoted or terminated. A terminated employee's membership is disabled; historical records remain. A department/position cannot be disabled while active/probation employees reference it. Managers cannot be transferred/terminated while they still have active direct reports; those reports must first be reassigned.
