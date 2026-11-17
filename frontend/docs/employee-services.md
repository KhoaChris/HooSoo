# Employee services and account security UI

`/employee-services/my` is the personal equipment, learning and offboarding view. `/employee-services` is the scoped management workspace. A single navigation entry per audience contains three query-string tabs, avoiding extra repeated sidebar destinations.

Creation uses the shared form/dialog, optional approved-request selector and only section-relevant fields. Detail dialogs show facts, history, task owners and server-provided actions. Cancel and final offboarding are destructive actions; returned/completed records use success colors; pending states use warning colors. Long forms keep action buttons visible and content scrollable. New labels use existing typography and paired light/dark tokens.

`/security` uses Firebase reauthentication before changing a password. `/policies` is public and reachable from login and the authenticated footer; its header handles anonymous visitors without requesting notifications. The favicon uses the existing blue HooSoo mark. New copy is in `i18n/employee-services.ts` and `i18n/security.ts`; user-entered content is not translated.

The query cache remains per account. There is no added periodic refresh or service preloading. CSV export operates only on the current filtered, authorized response and escapes formula prefixes.

Verification in this change uses an isolated synthetic browser preview: desktop/mobile, both languages/themes, create/detail/dropdown/password/public-policy views. HTTP permissions and lifecycle tests separately use the real API router with an in-memory store. No production password or Firebase record is changed by this preview.
