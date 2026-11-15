# Action spacing

Use the shared tokens in `src/style/base/tokens.css` for adjacent controls. Group controls in a layout container; do not add spaces or per-button margins to separate them.

| Token                  | Value | Usage                                                        |
| ---------------------- | ----- | ------------------------------------------------------------ |
| `--action-gap`         | 12 px | Labeled buttons, page actions, dialog footers, table actions |
| `--action-gap-compact` | 8 px  | Icon controls, month navigation, stage ordering              |
| `--action-link-gap`    | 28 px | Independent text links without a button surface              |
| `--action-icon-gap`    | 8 px  | A button/link label and its icon                             |

- Use `.row-actions` for page/list controls, `.form-actions` for form footers, and `.data-table-actions` for table heading controls. Existing feature-specific footers consume the same tokens.
- Allow groups to wrap and give them `min-width: 0`. Labels may wrap within a constrained button; icons must not shrink.
- Mobile actions that grow to fill a row use `flex: 1 1 auto`, keeping the label's intrinsic width before wrapping. Avoid `flex: 1` for independent labeled actions: its zero basis can squeeze English labels between icons and padding.
- Tables may retain their local horizontal scroll region and a single action row. Never make the entire page scroll horizontally to accommodate actions.
- Text links use a shared flex/wrap container, with 28 px between links and 8 px between rows. Preserve each icon with its own label.
- Segmented tabs, date-grid cells, number steppers, pagination and vertical menus retain their intentional control-specific spacing.
- Keep DOM/tab order, accessible labels, semantic colors, and action behavior unchanged when adjusting spacing.

Verification for the November 15, 2026 audit is in `output/playwright/action-spacing/`: source audit, fixture preview, screenshots, responsive measurements, and typecheck/lint/build logs. Browser checks use the actual frontend components/styles with synthetic data and API calls disabled.
