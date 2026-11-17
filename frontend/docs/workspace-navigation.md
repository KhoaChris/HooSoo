# Workspace navigation

Navigation keeps one canonical route per feature and filters by role before rendering or searching. The most specific path owns the active state, including personal routes and detail pages. HR sections group people and organization, hiring and onboarding, time and approvals, and performance and rewards. Related links on HR pages use the same definitions and permissions.

Related navigation separates the non-interactive category label from its page links. All four HR groups share a folder-tree icon, caption-sized sentence-case label and vertical divider on desktop; page links use the compact text size and retain their hover, focus and selected states. On mobile the category sits on its own line above wrapping links with 44 px touch targets. The visible category labels the navigation landmark and is not a keyboard stop. Theme colors come from shared tokens.

Expandable sections reduce sidebar density; the current section opens by default. Search matches both Vietnamese and English labels, including Vietnamese without accents, without making API requests. The compact sidebar retains tooltips. The mobile drawer traps focus, includes the search field in its keyboard cycle, closes after navigation, and restores focus.

Requests use a searchable catalog grouped by work, development and benefits. Leave and schedule links open their existing pages instead of creating duplicate workflows. Forms, actions and dropdowns reuse shared components and spacing tokens.

The Admin band entry appears in management and personal compensation headers for Admin only. The server remains authoritative for all salary permissions.

Validation evidence is in `output/playwright/workspace-experience`: 68 responsive/theme/locale cases, 8 interactive flows, and screenshots. These previews use synthetic data and cannot reach Firebase.

## Content tabs

Candidate detail, performance workspace and performance detail share `SectionTabs` and `SectionTabPanel`. A static folder caption labels each tablist and is never a focus stop. Buttons have a border, selected underline and theme-based fill; they wrap into readable rows instead of widening the page. Labels use sentence case in Vietnamese and English. Arrow keys, Home and End move between enabled tabs; each tab controls its labelled panel. Pending CV changes still lock navigation. Personal performance results use ordinary content without a tablist.

The candidate reader keeps tabs and actions outside its scrollable content. Other dialogs retain their shared sticky form actions. Layout and keyboard evidence, including checks against the running app, is in `output/playwright/feature-tabs`.
