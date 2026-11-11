# Four-role cloud synchronization review

Verified on 2026-11-11 against Firebase project `hoosoo-37881`, using the existing backend on port 4000 and frontend on port 5173. Four tabs shared one Chromium browser context and the same origin. Each tab signed in through the real login form with a separate synthetic Admin, HR, Manager or Employee account. No emulator or API mock was used.

## Results

| Check | Observed result |
| --- | --- |
| Reload all four signed-in tabs | Every tab retained its own role and identity. |
| Admin creates a department | Both department tables and both organization charts showed the new record within 1.36 seconds of submitting the form. |
| HR edits that department | All four views showed the new name within 1.32 seconds, without reload. |
| Refresh requests after each save | Exactly one relevant GET per test tab; no duplicate refresh in either save. |
| Shared Firestore change listener | One listener document read per commit across the four test tabs and an existing dashboard session. |
| Four tabs idle for 40 seconds | No business GETs and no additional SDK document reads, excluding the diagnostic meter. |
| Nine navigation clicks across Employees, Positions and Departments | No business GETs or additional SDK document reads after warming those screens. |
| Scope checks | HR system-usage access, Manager audit access and Employee employee-directory access each returned 403. |
| Admin signs out | The other three tabs retained their identities and remained signed in. |
| Direct persistence | An independent Admin SDK transaction read the edited record from Firestore and verified its name and timestamp. |
| Existing unit suite | 41 backend and 11 frontend tests passed. |

Only the temporary department created by this review was deleted during cleanup. The cleanup transaction verified its unique test description and that no employee belonged to it, then deleted that document and advanced the organization version. All four tabs reflected removal automatically. Audit history was retained.

The application source, configuration, routes and user-managed backend process were unchanged during this verification. Backend PID 26515 remained running throughout.

## Read measurement

The process-wide SDK estimate increased by 37 reads during creation and 25 during editing. These totals include two reads for the diagnostic endpoint and an existing dashboard session's refresh (11 and 6 reads respectively). The four test tabs made exactly four business GETs in each phase. Their department/tree reads were 16 during creation and 8 during editing; the corresponding write transactions read 7 and 8 documents. One additional metadata read notified all clients after each commit.

These figures describe this dataset and the observed requests. SDK instrumentation is not Firebase's billing report. Initial login/reload, stale-cache refresh, permission checks and network reconnection can require reads; the zero-read observations apply to the measured idle and warm-navigation periods. This review covered department creation/editing plus session and permission isolation, not every business mutation or prolonged network loss.

Evidence:

- `output/playwright/four-role-cloud-review.json`: timestamps, per-tab network requests, role checks, process counters and assertions.
- `output/firebase/four-role-cleanup.json`: direct Firestore persistence verification and cleanup result.
- `output/playwright/four-role-{admin,hr,manager,employee}.png`: final application views after cleanup.
