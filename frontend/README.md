# Frontend source map

The application keeps routes and business behavior unchanged while making screens and presentation easier to find.

```text
src/
  app/                    Authentication/session provider
  config/                 Validated environment and Firebase initialization
  routes/index.tsx        URLs, lazy page imports and role guards
  layouts/app-layout.tsx  Header and application shell
  layouts/navigation.ts  Navigation labels, routes, icons and role visibility
  pages/                  One route component per file, grouped by area
    auth/                 Login and password reset
    dashboard/            Overview
    employees/            List, editor and employee/profile detail
    organization/         Organization chart and department/position catalog
    attendance/           Personal/team attendance
    leave/                List, create and request detail
    workflows/            Personal work calendar, internal requests and approvals
    recruitment/          Hiring board, stages, candidate profile and CV dialogs
    reports/              Reports and CSV export
    settings/             Company/HR policy, users, system and audit
      components/         HR-only leave-type and balance sections
    errors/               403 and 404 page
  components/navigation/ Responsive sidebar and mobile drawer
  components/ui/          Shared button, input, checkbox, textarea, select,
                          tooltip, toast, form, modal, table and display components
  hooks/                  API/query hooks, live updates, catalogs and sidebar state
  services/               API transport, navigation cache and query synchronization
  utils/date-time.ts      Vietnamese date/time display helpers
  styles.css              CSS import entry only
  style/
    base/                 Tokens, global defaults, typography and utilities
    layout/               Application shell and responsive navigation
    components/           Shared UI styles, one file per category
    pages/                Page-specific presentation and responsive rules
```

## Finding the right file

| Change | Source | Styles |
| --- | --- | --- |
| Employee form | `src/pages/employees/employee-editor-page.tsx` | `src/style/components/form.css` |
| Employee profile | `src/pages/employees/employee-detail-page.tsx` | `src/style/pages/employees.css` |
| Dashboard | `src/pages/dashboard/dashboard-page.tsx` | `src/style/pages/dashboard.css` |
| Organization chart | `src/pages/organization/organization-page.tsx` | `src/style/pages/organization.css` |
| HR policy | `src/pages/settings/settings-page.tsx` | Shared form/panel styles |
| Account permissions | `src/pages/settings/users-page.tsx` | Shared table/form/modal styles |
| Dropdown | `src/components/ui/select.tsx` | `src/style/components/select.css` |
| Text/number/date input | `src/components/ui/input.tsx` | `src/style/components/input.css` |
| Checkbox | `src/components/ui/checkbox.tsx` | `src/style/components/checkbox.css` |
| Save notification | `src/components/ui/toast.tsx` | `src/style/components/toast.css` |
| Sidebar and mobile drawer | `src/components/navigation/app-sidebar.tsx` | `src/style/layout/sidebar.css` |
| Sidebar preference | `src/hooks/sidebar.ts` | Application width in `src/style/layout/app.css` |
| Tooltip | `src/components/ui/tooltip.tsx` | `src/style/components/tooltip.css` |

`components/ui/index.ts` is the public import entry for shared UI. Components inside that folder import siblings directly to avoid circular imports. Pages import shared catalog queries from `hooks/catalogs.ts`, not another page. Date utilities live separately from UI.

Keep responsive rules in the same CSS file as their owning component/page. All styles are imported once through `styles.css` in an explicit order so navigation/lazy loading cannot change the cascade. Pages composed entirely of shared components do not need empty page stylesheets. Keep API calls, permissions and persistence in the existing hooks/services/backend; moving or styling a screen does not change its endpoint or payload.

Native input semantics (including dates, numeric keyboard controls and form refs) are retained behind the shared controls. Checkboxes use a custom appearance with a forced-colors fallback; selects use the shared custom menu. No cloud/emulator configuration changes are needed.

The desktop sidebar toggles between its normal width and a 76px icon rail. Hover or keyboard focus displays custom labels without expanding the rail. `hooks/sidebar.ts` stores this presentation preference in per-tab `sessionStorage`; toggling or hovering does not call the API. Below 901px, navigation uses a full-label drawer with Escape, focus containment, scroll locking and focus restoration. Motion follows the browser's reduced-motion preference. Authentication, role checks and database synchronization remain in their existing layers.

## Verification

API queries reuse a per-account, per-tab memory cache for 5 minutes. Small shared lists are warmed after login; department/position tables reuse their dropdown data. Saves and live events invalidate the affected cache immediately. Employee/audit searches wait 350 ms after typing. See [navigation cache review](../docs/navigation-cache-review.md) for request measurements, session behavior, the Watch-Shop environment comparison and remaining backend read costs. Run `npm run test:frontend` from the repository root for cache/synchronization regression tests; `npm test` includes them.

See `../docs/frontend-structure-review.md` for the structural checks, browser comparison and test scope. Local checks:

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Work calendar and request styles are in `style/pages/workflows.css`; recruitment styles are in `style/pages/recruitment.css`. New forms reuse the shared dialogs and pending-change guards. The calendar observes company hours and holidays; server validation remains authoritative. Recruitment provides pointer dragging and a next-stage button for keyboard/touch. All pages reuse the existing per-session query cache and scoped event invalidation. See [workflow contracts](../docs/hr-workflows.md).

Role access reference and professional work screens live in `pages/professional/`, with page styles in `style/pages/access.css`. They reuse existing dialogs, forms, custom selects, tables, per-account caching and collection event invalidation. Shared role definitions drive navigation, route guards and role descriptions; server-provided capabilities control protected employee, catalog and balance actions. See [access and specialty contracts](../docs/access-and-specialties.md).
