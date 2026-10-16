# BOM scenario table requirements and design

Status: business requirements and recommended evolution, 2026-10-10. This document does not claim the proposed column factories or display policy are implemented.

## Ownership

The application has scenarios for a bill of materials, with three table types and approximately sixteen columns per table. Each table displays materials participating in the finished good. Backend calculations can affect parents, children and other rows after an edit.

The backend owns quantities, costs and other calculated results. Frontend value getters select returned fields; they do not recreate backend formulas. Frontend rules own display, precision, alignment, tooltips, edit permission and markers.

The feature owns the committed scenario dataset, server requests, response ordering and table synchronization. Each editor owns only its draft. Renderers derive disposable presentation from committed data and column rules.

## Column composition

Keep three explicit table column lists. Share small typed factories for repeated conventions: number, text, toggle, dropdown and hosted-editor columns. Compose column-specific rules and editors into these factories. Avoid adding table-type switches to shared renderer components.

A number-column factory should provide these defaults:

- End alignment, which is right alignment in the application's left-to-right layout.
- Decimal formatting when configured, preserving the backend value.
- A tooltip showing the unrounded source value when decimals are configured. Explicit tooltip configuration overrides the default; `null` disables it.
- A column-specific policy for placeholders and missing values.
- Optional marker and permission rules, without mounting an editor until requested.

Factory composition must preserve nested defaults when overriding one category. It should connect the row field or getter type, renderer config, editor opening data and save payload. The current `bindCellRenderer` checks only the renderer/config relationship.

Constants and pure callbacks should be supported where presentation varies by row or application settings. If decimal precision varies by row, resolve its rule before calling the shared formatter; the formatter itself should continue to accept resolved options.

## Raw values and presentation

Preserve numeric source values and model display decisions separately. A proposed display policy can select either the normal value or an explicit placeholder with text. A blank placeholder can coexist with a warning and an edit action. Dash and N/A are distinct configured outcomes, not global interpretations of null or zero.

Evaluate this display policy before numeric empty-value handling. Formatting runs only for a displayed number. Placeholder text must not be written to the row or sent as an edited numeric value. Sorting, filtering and export need explicit policies if their semantics must follow the placeholder instead of the raw value.

Rules that share applicability conditions should call the same named feature helper. Keep marker and permission calculations separate so hiding a value does not accidentally grant or revoke permission. Retain the current marker priority as a default. Simultaneous warning and provenance markers would require an explicit product decision; the current renderer displays one winning marker.

## Server commit flow

1. Capture the scenario, table and stable BOM row identity, the typed change payload and any request parameters. A complex editor submits its related fields together in one request when supported by the endpoint.
2. Keep the committed dataset unchanged while the request is pending. Display pending/error state independently from the draft.
3. Accept only a response belonging to the current scenario/dataset generation. Prevent older responses from overwriting newer state. Serialize dependent edits when the backend supplies no revision protocol.
4. Publish the accepted canonical snapshot so all row lookups and presentation rules observe that snapshot, then synchronize the grid through one owned update path.
5. After row-model synchronization, force a presentation refresh of rendered cells in every table whose dependencies may have changed. Do not restrict refresh to the edited cell or only cells with changed numeric values.
6. Newly virtualized cells derive their presentation from the latest committed snapshot.

Use stable BOM occurrence IDs, not material codes alone: the same material may occur in different tree locations. Scope asynchronous work to its scenario and table. Existing row-model tree configuration should preserve the hierarchy, expansion and row identity during replacement.

The exact response contract remains to be confirmed: a complete table snapshot must replace rows, an affected-row response must merge by identity and explicitly represent removals, and a response covering several tables should be committed as one consistent feature update. Do not infer which contract applies from the number of returned rows.

## Signals and rendering cost

Keep column definitions stable. Keep explicit category `computed()` signals in custom renderers, with rule definitions supplied by the feature. A callback declared in a column remains feature logic even when the renderer evaluates it inside a computed signal.

Do not read a shared whole-dataset signal in every cell unless the rule actually depends on it. Row-local rules should use the current renderer params. Cross-row rules can use a shared index or lookup built once per committed dataset, avoiding a full-row scan per cell.

Use ordinary AG Grid cells for columns requiring only formatting, alignment and native tooltips. Use custom renderers for markers, controls and edit actions. Retain a stable custom renderer for columns whose decorations frequently change unless measurement justifies dynamic standard/custom selection. Dynamic selection must also handle signal-only changes and unchanged raw values.

Keep row/column virtualization enabled, render only required marker/action elements, and mount complex editors on demand. Prefer refresh over rebuilding rows. Re-evaluating visible presentation does not require creating DOM for every row. These behaviors follow AG Grid's [view refresh](https://www.ag-grid.com/angular-data-grid/view-refresh/) and [virtualization](https://www.ag-grid.com/angular-data-grid/dom-virtualisation/) contracts. Stable row IDs let AG Grid reconcile [replacement row data](https://www.ag-grid.com/angular-data-grid/data-update-row-data/).

## Current gaps and acceptance checks

The existing kit supplies signal-driven renderers, marker priority, typed editor data and an editor host. The demo server path already supports replace/upsert responses, serialized requests and dataset-generation checks.

Still needed for the described production workflow:

- Numeric placeholder policy. Currently null/non-finite values return blank before `content.text` is evaluated.
- Shared number-column defaults. Alignment currently defaults to start; full-value tooltips require manual configuration.
- Rule-based decimal precision if the business requires per-row precision; current precision is a static number.
- Column factories that connect getter types to renderer and editor types.
- A verified BOM tree integration with stable occurrence IDs and real scenario/table identity. The current showcase is a flat demo.

Acceptance tests should cover a child edit changing its parent, a parent edit changing children, unchanged values with changed permissions/markers, dash/N/A/blank transitions, zero, rounded display with unrounded tooltip, a multi-field request, scenario switching during a pending request, and scrolling updated rows into view. Performance measurements should use representative BOM depth, expanded row count and the actual sixteen-column mix.

This extends the general [grid-cells review](grid-cells-review-2026-10-10.md). It also identifies a decision to revisit in the earlier column-driven proposal: preserving numeric getters and separating placeholders from raw values avoids introducing mixed numeric/text values solely for display.
