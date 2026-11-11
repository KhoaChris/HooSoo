# Shared dropdown

`frontend/src/components/ui/select.tsx` owns the application's dropdown UI. All twelve list/report filters and every `FormField` with `type: "select"` use this component, including employee, leave and account forms.

```tsx
<Select
  aria-label="Phòng ban"
  value={departmentId}
  onValueChange={setDepartmentId}
  options={[
    { value: "", label: "Tất cả phòng ban" },
    ...departments.map((item) => ({ value: item.id, label: item.name })),
  ]}
/>
```

Values remain strings. Empty/all/none choices are explicitly selectable; internal option encoding never leaves the component. Forms use React Hook Form's `Controller`, preserve defaults, submit the original values and focus the first invalid field. Always provide a visible associated label or `aria-label`. Options may be disabled; an empty option list disables the trigger.

The HooSoo styles provide the trigger, teal selection/check mark, focus state, scrolling menu and reduced-motion handling. [Radix Select](https://www.radix-ui.com/primitives/docs/components/select) supplies focus management, keyboard navigation and collision positioning. Menus portal into the nearest native dialog when present, so they remain interactive above its backdrop. Escape closes the dropdown first and returns focus to its trigger. Long labels wrap inside the menu and truncate in the trigger.

## Verification — 2026-11-11

- Workspace lint and TypeScript checks passed; the frontend production build passed.
- Browser checks used the actual shared components in a temporary isolated preview, without cloud API calls or writes. That preview was removed after review.
- Verified selection with pointer and keyboard, Arrow/End/Enter/Escape, required-field validation and focus, disabled/empty lists, selecting empty values, filter reset and exact form payloads.
- Verified a native dialog menu remains visible and clickable, Escape keeps the dialog open, focus returns correctly, and submitting a role produces `Manager` rather than an encoded option value.
- Verified an 80-item list, scrolling to the last option, outside-click dismissal, and menu bounds at 390 × 844. Desktop and mobile captures are in `output/playwright/dropdown-*.png`.
- Existing E2E selectors were updated to use the visible combobox/options. The complete Auth/API E2E suite was not rerun for this UI-only change.

This component has no data-fetching or persistence logic. Existing API submission and Firestore synchronization remain owned by the feature hooks and backend.
