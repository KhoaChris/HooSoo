# HR feature coverage — 2026-11-15

This is a source-level scope map for the academic HooSoo project, not a claim that every enterprise HR product feature is implemented. Historical cloud reports remain separate from the local verification of this update.

| Area                              | Available workflow                                                                                                                           | Current boundary                                                                         |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Identity and organization         | Account provisioning, role hierarchy, employee profiles, departments, positions, reporting lines, organization chart                         | Authorization comes from membership and assigned scope, not job titles                   |
| Recruitment                       | Vacancies, candidates, CVs, stage-specific cards, guarded Kanban movement, interview proposals and structured scorecards, hiring conversion  | No external job-board integration or automatic background checks                         |
| Employment                        | Contracts, probation decisions, onboarding checklists                                                                                        | Documents and workflow records, not qualified electronic signatures                      |
| Attendance and leave              | Check-in/out, adjustments, company calendar, balances, approval/rejection/cancellation                                                       | Whole-day leave; no biometric integration or statutory overtime engine                   |
| Employee requests                 | Attendance correction, business travel, remote work, confirmation letters, equipment, training, reimbursement and other configured requests  | Approval does not itself transfer money or purchase goods                                |
| Performance                       | Quarter/year selection, qualitative objectives, supervisor evaluation, editable reviews, escalated reports and final decisions               | No employee self-scoring requirement; reporting remains scoped                           |
| Compensation and benefits         | Basic salary/allowances/benefits, effective adjustments, publication, personal views and shared Admin band                                   | Does not calculate tax, insurance, net payroll or bank payments                          |
| **Equipment — added**             | Approved equipment request → unique asset assignment → employee acknowledgement → return request → HR receipt; CSV and history               | Assignment register, not purchasing, depreciation or inventory valuation                 |
| **Learning — added**              | Approved training request → enrollment → employee reflection/certificate link → scoped manager recognition or revision                       | No video course hosting, examination engine or external LMS integration                  |
| **Offboarding — added**           | Employee/manager/HR task ownership, asset clearance, direct-report reassignment, final-day check → atomic employment/access/contract closure | Admin authority must be transferred first; financial settlement is a human-reviewed task |
| Collaboration                     | Direct/group messages, grouped bubbles, archive, leave/dissolve group, online/DND/invisible presence                                         | Admin role does not grant private-message access                                         |
| Governance                        | Scoped dashboards, reports/CSV, audit, API Explorer, system usage, company policies                                                          | Analytics are not a data warehouse; exports remain permission-scoped                     |
| **Account security — added**      | Current-password reauthentication, password change, sign-out, revocation checking on API requests                                            | MFA/SSO enrollment and recovery procedures remain deployment work                        |
| **Policies and branding — added** | Public bilingual data/use/copyright page, footer entry, matching favicon                                                                     | Project policies are descriptive; they do not establish legal certification              |

## Thesis demonstration sequence

1. Employee submits an equipment/training request; the designated reviewers approve it.
2. HR opens **Employee services**, chooses the approved source request and creates the assignment/enrollment.
3. Employee acknowledges equipment or submits a learning outcome. A manager can recognize only a subordinate in scope; an outsider is rejected by the API.
4. HR creates offboarding; each assigned owner confirms their checklist items.
5. Equipment still outstanding prevents completion. After HR receives it, a final completion ends employment, closes active contracts and disables the membership atomically.
6. Repeat a successful request with its idempotency key: no duplicate record. Reuse a stale record version: conflict response. Remove the reviewer's scope: replay access is rechecked.
7. Inspect audit/history and export the currently filtered records. Switch VI/EN, light/dark and narrow viewport.

## Deliberately separate future work

Period payroll/payslips, jurisdiction-specific tax and insurance, overtime/shift premiums, MFA/SSO, validated electronic signatures, advanced course administration and external integrations require their own requirements, rules and tests. They should not appear as working features in the thesis unless implemented and verified.

For a production deployment also complete the release gates in `../../SECURITY.md`: infrastructure TLS, IAM/rules deployment, dependency remediation, backup/restore, performance testing and independent security review.
