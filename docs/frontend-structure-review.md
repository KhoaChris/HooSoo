# Frontend organization review

Date: 2026-11-11 (Asia/Ho_Chi_Minh).

## Source organization

Route screens now live in `frontend/src/pages/`, grouped by area and separated into individual page files. HR-only sections stay in `pages/settings/components/`. Shared catalog queries moved to `hooks/catalogs.ts`; date formatting moved to `utils/date-time.ts`.

The former `components/ui.tsx` bundle is now `components/ui/`, with individual button, badge, input, textarea, checkbox, select, form, modal, toast, table and display components. Its `index.ts` is the public UI import entry. Toast no longer lives in the application entry point.

The original 1,982-line stylesheet is now a 33-line import entry. `style/base/` contains global settings and utilities, `style/layout/` owns the application shell, `style/components/` contains shared controls, and `style/pages/` contains page-specific styles. Responsive rules stay beside the styles they override. All imports have a fixed order to preserve the cascade independently of route loading.

Inputs and textareas now use shared components with unchanged native values and refs. Checkbox appearance is custom, with native keyboard/checked semantics and a forced-colors fallback. Native number spinners were removed while preserving numeric keyboard controls and the year field's footprint. Existing custom dropdowns, buttons, dialogs and notifications retain their behavior.

See [the frontend source map](../frontend/README.md) for the full directory tree and file lookup table.

## Verification

- Compared the route tree and role guard syntax before/after: unchanged.
- Compared eight Auth/config/data-hook/API/synchronization files byte-for-byte: unchanged.
- Loaded 24 existing URLs at 1440 × 960 and 390 × 960 (48 page/viewport combinations), using actual page components with isolated API/auth fixtures. Compared element geometry and nine computed style properties against the pre-refactor snapshot. Final differences: zero, after normalizing the added shared input class tokens and class whitespace.
- Fixed two cascade/footprint changes found during comparison: dashboard recent-table padding on mobile and the HR year field's intrinsic width.
- Submitted the actual employee form through its normal action hook in the isolated review. It still supplied the expected `POST /employees` payload, including original select IDs, empty manager, active status and date string; the detail route rendered afterward.
- Verified the extracted toast responds to the saved event. Verified the custom checkbox toggles with Space and submits booleans through the leave-type form. Numeric ArrowUp behavior remains available.
- Workspace lint, all workspace TypeScript checks, 37 unit tests and backend/frontend production builds passed. The frontend build was repeated after the final CSS adjustment.

The review used a temporary Vite transform on a separate local port, without changing application Auth/API files or Firebase environment configuration. Temporary source scripts and that server were removed/stopped after verification. The normal app continues using its existing cloud connection. This is UI/structure evidence, not a new cloud write verification; the complete backend integration/E2E suite was not rerun for this change.

Evidence: `output/playwright/structure-validation.json`, `structure-employee-form.png`, and `structure-custom-checkbox.png`. The older `SOURCE_MANIFEST.sha256` remains a historical release manifest, not an index of the current development tree.
