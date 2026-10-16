# Material editor migration results

Implemented 2026-10-04 with Angular 21.2.25 and Material/CDK 21.2.14.

InputEditor, TextareaEditor, DetailsEditor, and SessionDemoEditor now use outlined Material fields, matInput, and Material buttons. Field errors use mat-error and Material's touched/submitted visibility. Optional validators, async validators, numeric/null values, and each editor's existing actions and save mappings remain intact. Persistence errors stay separate live alerts.

The dialog already used MatDialog. Its content adapter now uses mat-dialog-content alongside mat-dialog-title. The adapter still mounts the configured editor, with no shared action footer. Material owns the dialog container; the existing coordinator retains Escape, close reasons, focus restoration, and table interaction locking.

DropdownOptions now uses a single-selection Material list inside the existing custom popover. Its public typed inputs and selected output remain compatible. It restores the committed option before emitting save intent, so a pending or failed request does not commit a selection. Object equality, disabled options, keyboard selection, retry, and cancellation are covered. It creates no second overlay.

Grid renderers remain native. Editor styles use Material theme tokens and layout rules instead of custom field/button colors. The application supplies its global Material theme. A small top inset prevents outlined floating labels from clipping in the popover's scrolling body. Width constraints, action wrapping, textarea resizing, and dialog scrolling remain usable.

## Validation

Production build, 151 unit tests, compile-only type checks with 24 expected rejection cases, and 44 browser checks pass. Material harnesses replace native-select assertions. Browser coverage includes field-error association, keyboard selection, pending/failure/retry, both backdrop settings, both scroll axes, internal editor scrolling, focus restoration, requests completing after closure, row/anchor removal, navigation, narrow popovers, and automated accessibility checks.

Material intentionally omits aria-invalid for empty required inputs. The checks verify required state and associated error descriptions there, then verify aria-invalid for a nonempty value failing its configured validator.

Screenshots of generic input validation, textarea, complex details, dropdown options, and a 390px viewport popover were inspected. Generated screenshots are in ignored `artifacts/material-editor-*.png`.

## DOM observations

The same 1,000-row, 200-column, 1440 × 1000 development fixture retains 297 resting renderer hosts, 675 direct renderer children, and 729 renderer descendants. These counts match the saved step-12 observations. Editors remain on demand.

The existing integration sequence repeats each presentation four times. Comparable open-editor descendant counts are:

| Presentation            | Native editor before | Material editor after |
| ----------------------- | -------------------: | --------------------: |
| Popover input           |                   17 |                    37 |
| Dialog textarea         |                   20 |                    39 |
| Dropdown picker         |                   16 |                    39 |
| Composite numeric input |                   17 |                    37 |

Every repeated close leaves zero mounted editors, overlay panes, backdrops, focus-trap anchors, and grid locks. Closed live grid counts remain stable within each presentation path. No browser page errors were recorded. Material's extra editor DOM is expected and does not multiply across resting cells.

A separate measurement records total pane descendants, including panel wrappers and a complex Details editor. It uses different counts from the integration sequence above; do not compare the two measures directly. Reviewed raw records are [Material editor observations](baselines/material-editors.json) and [repeated lifecycle observations](baselines/material-editor-integration.json). Historical step-12 measurements remain unchanged.

The production demo has approximately 290.76kB raw initial code/styles and a 2.96MB raw lazy grid feature, versus 289.17kB and 2.90MB previously. These are demo bundles with all Enterprise modules and fixtures, not isolated library measurements. No CPU/FPS benchmark or detached-heap analysis was performed for this styling migration.

## Reproduce

```sh
npm run build
npm run test:unit
npm run test:types
npm run test:e2e
```

This report records the completed Material editor migration. The [usage guide](cell-kit-usage.md) describes current presentation and integration behavior. Renderer params, editor sessions, public exports, persistence operations, and query-param handling remain compatible.
