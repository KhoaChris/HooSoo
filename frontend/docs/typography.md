# Workspace typography

## Font and loading

Use the self-hosted Inter variable font for UI copy in Vietnamese and English.
`src/style/base/fonts.css` declares the Latin, Latin Extended and Vietnamese
subsets in `public/fonts/inter/`. They come from `@fontsource-variable/inter`
5.3.0 and retain the SIL Open Font License in that directory. The font is served
with the app; no third-party font request is needed. `font-display: swap` keeps
text readable during loading. Real variable weights avoid synthetic bold.

## Hierarchy

Size and weight tokens live in `src/style/base/tokens.css`. Themes share this
scale; only semantic colors change between light and dark appearance.

| Role                                             | Desktop | Mobile ≤600 px | Weight  |
| ------------------------------------------------ | ------- | -------------- | ------- |
| Page title                                       | 27 px   | 23 px          | 650     |
| Dialog title                                     | 20 px   | 18 px          | 650     |
| Section heading                                  | 17 px   | 16 px          | 650     |
| Subsection heading                               | 15 px   | 15 px          | 650     |
| Body                                             | 14 px   | 14 px          | 400     |
| Compact content                                  | 13 px   | 13 px          | 400–500 |
| Input, textarea, date picker, select and options | 13 px   | 16 px          | 400     |
| Buttons and action links                         | 13 px   | 13 px          | 600     |
| Form labels, status badges                       | 12 px   | 12 px          | 500     |
| Eyebrows and supporting metadata                 | 11 px   | 11 px          | 400–600 |

Sidebar section labels share one 11 px / 650 treatment; navigation items use
12 px / 500 and the selected item uses 650. Compact table headings and form
subsections use 13 px / 650. Numeric metrics, avatar initials, the brand and the
login illustration headline are intentional display-size exceptions.

Use heading line height 1.4, controls 1.5 and body 1.6. Longer descriptive
paragraphs may use 1.7–1.8. Keep explicit line-height and weight on controls so
they do not inherit a surrounding label's weight. Select content rendered in a
portal must use the same font tokens as its trigger. Selected options use 600.
Mobile input text stays at 16 px to avoid focus zoom on iOS.

## Capitalization and translation

Use sentence case for navigation, headings, labels, tabs, badges and actions in
both languages. Write it in the copy; do not use `text-transform: uppercase` or
`capitalize`. Preserve proper names, existing user content, IDs and acronyms
such as API, KPI, HR, CV, VI and EN. Translate application copy through `t()`;
do not transform persisted business values when the locale changes.

## Layout and validation

Allow long headings and action labels to wrap within their containers. Keep
icons separate from the text and preserve the shared action gaps. Table and
Kanban scrolling belongs to the component, not the entire page. Long dialogs
must retain reachable footer actions when the body scrolls.

When changing typography, inspect actual font loading and rendered text at
desktop and 390/320 px widths in VI/EN and light/dark. Include an open dropdown,
a long add/edit dialog, and the expanded mobile sidebar. Build and lint are
necessary checks but do not replace browser inspection.
