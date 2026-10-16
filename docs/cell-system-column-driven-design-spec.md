# Column-driven cell system design specification

Status: proposed evolution of the current cell kit, 2026-10-10.

This specification records the design discussed for values, empty states, renderer selection, editing and Excel export. It separates the current implementation from the proposed integration. The existing [as-built specification](cell-renderer-system-spec.md) remains the reference for implemented contracts.

## 1. Design decision

Keep dedicated, grouped-column value getters as the authority for each cell's resolved value. Keep dedicated warning, info, system-generated and edit-permission functions. Those functions read the relevant source fields in canonical row data and share business policy helpers where their conditions overlap.

Add a small preparation adapter at the AG Grid column seam. It coordinates these existing functions, chooses standard or custom rendering, and supplies prepared presentation values to custom renderers. It does not calculate the cell value again or introduce a second business resolver.

Excel export uses the same value semantics and unit definition. Numeric cells export as numbers, with a separate unit column immediately after the value column.

## 2. Requirements

- Canonical row data owns stored values. Column definitions and their dedicated functions own how those values appear.
- Rules may depend on another field, another row, grouped columns or the dataset. Row level is only one possible condition.
- Null, undefined, empty string and zero have column-specific meaning. Zero is a valid numeric value unless the column explicitly treats it as empty.
- A cell can resolve to a number, configured DASH text, configured NA text or an empty value without rewriting its source field.
- DASH and NA cells without interactions or markers use standard AG Grid rendering.
- An empty cell with a missing-value warning supports its configured editor. Permission determines whether the user can activate it.
- Export preserves the grid's resolved meaning. It does not concatenate a numeric value and its unit.
- Business rules run outside renderer templates. Renderer state is derived and disposable.
- Edits, metadata changes and changes to dependencies update presentation even when the column's resolved value stays unchanged.

## 3. Current implementation and proposed changes

| Area               | Current implementation                                                                                                  | Target design                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Content            | `content` owns text and optional `content.number` formatting                                                            | Preserve this grouping; resolve row-dependent presentation before passing it to a renderer |
| Editing            | `action.editor` owns the editor component, data factory and presentation options                                        | Preserve this grouping and on-demand editor data                                           |
| Lifecycle          | `BaseCell` receives `agInit` and `refresh` params through a signal                                                      | Preserve the bridge; supply fresh prepared state on refresh                                |
| Category state     | Renderers call `computeContent`, `computeMarker`, `computeAction` and related calculations through Angular `computed()` | Keep explicit category signals; remove business rule evaluation from the renderer path     |
| Markers            | Priority is error, warning, userEdited, systemGenerated, info, special                                                  | Preserve priority unless a feature explicitly requires a separate design change            |
| Controls           | Toggle and dropdown have dedicated controls; dropdown opens its editor in a popover                                     | Preserve control behavior and default presentation                                         |
| Number emptiness   | Numeric calculation renders missing/non-finite values blank and treats zero as valid                                    | Add column policy for placeholders and missing-value editing before numeric rendering      |
| Renderer selection | Features wire renderer configurations                                                                                   | Add explicit standard/custom selection based on prepared requirements                      |
| Excel              | The shared kit has no Excel projection engine                                                                           | Add a table export projection with numeric and unit columns                                |

The demo's shared `showUnits` signal currently controls inline display. It does not satisfy the separate Excel unit-column requirement. Migration should remove or rename that setting so export policy and inline display policy are distinct.

The user's production grouped-column getters are a design input from the discussion. This repository's demo does not contain those complete business rules. Examples below describe the proposed contract rather than an implemented business schema.

## 4. Ownership

| Owner                          | Responsibility                                                                                                    |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Feature row store              | Canonical rows, stable IDs and the current dataset                                                                |
| Column definition              | Dedicated getter, source-field access, formatting, marker rules, action/control configuration and export metadata |
| Dedicated getter               | The cell's resolved value, including column-specific empty and applicability policy                               |
| Shared business policy helpers | Conditions reused by getters, warnings and permissions                                                            |
| Preparation adapter            | Evaluate presentation rules, preserve the grid-provided value, select a renderer and prepare its params           |
| Renderer                       | Render prepared content, marker and action/control state; handle local interaction                                |
| Hosted editor                  | Draft, validation, pending state and save/error UI                                                                |
| Feature persistence            | Recheck permission, validate and commit canonical rows                                                            |
| Grid update integration        | Update rows, invalidate dependent calculations and refresh affected presentation                                  |
| Export projection              | Build export columns and cells from the same column semantics                                                     |

Do not create a universal backend service or replace the existing editor host as part of this change. Existing [editor](cell-editors.md) and [persistence](feature-persistence.md) responsibilities remain applicable.

## 5. Value and rule contracts

### 5.1 Distinguish source, resolved value and presentation

| Concept               | Example                          | Use                                            |
| --------------------- | -------------------------------- | ---------------------------------------------- |
| Source field          | `row.amount` is null             | Missing-input warning and initial editor draft |
| Resolved value        | Dedicated getter returns `''`    | Grid value and export value                    |
| Prepared presentation | Blank text, warning, enabled pen | Custom renderer params                         |
| Formatted text        | `1,250.50 kg`                    | Grid display only                              |

`params.value` is the getter's result. It may be a calculated number or a placeholder. It is not a reliable substitute for the original row field.

A missing-input warning reads the configured source field from the row. A calculated-total warning reads the relevant calculation or its inputs. Neither rule universally checks `params.value === ''`.

Editable calculated columns must explicitly identify the source field or inputs that their editor changes. A display placeholder must never become an editor's initial numeric value.

### 5.2 Keep dedicated grouped-column getters

Each column assigns its existing dedicated getter. Shared grouped-column logic stays in named feature functions, rather than inline functions copied into column definitions.

The getter may return numbers and configured placeholder strings. Numeric results remain numeric. It must not return a string such as `1250.5 kg` for a valid amount.

Getters and presentation rules are synchronous and pure. They receive current row/dataset inputs explicitly through the feature's integration. They do not write rows, open editors or perform HTTP requests. AG Grid also requires pure value getters and allows absent row data for some row types. See [AG Grid value getters](https://www.ag-grid.com/angular-data-grid/value-getters/).

### 5.3 Share conditions, not independent copies of the value calculation

For example, one named applicability helper can serve both the dedicated getter and the warning rule. One requiredness helper can serve warning and editing policy. The warning rule then checks the source amount only when the column applies and requires input.

This removes duplicated definitions of business conditions. A pure helper may execute more than once across grid callbacks. The design does not promise exactly one execution per cell and does not need a global presentation cache.

Do not add a second `resolveAmount` function that independently reproduces the getter's output. The preparation adapter receives AG Grid's resolved value.

### 5.4 Empty states are explicit column policy

| Condition for an example amount column | Resolved value        | Grid presentation                                    | Editing                                                    |
| -------------------------------------- | --------------------- | ---------------------------------------------------- | ---------------------------------------------------------- |
| Not applicable                         | Configured NA token   | Standard text                                        | None                                                       |
| Missing with DASH policy               | Configured DASH token | Standard text                                        | None                                                       |
| Missing, optional                      | Empty value           | Standard blank                                       | None unless explicitly configured                          |
| Missing, required and editable         | Empty value           | Custom blank with warning and pen                    | Configured editor                                          |
| Required input, permission denied      | Empty value           | Custom blank with warning and disabled action/reason | No activation                                              |
| Valid number                           | Number                | Formatted number, optionally with unit               | Depends on column action                                   |
| Zero with normal numeric policy        | `0`                   | Formatted zero                                       | Depends on column action                                   |
| Zero with explicit DASH policy         | Configured DASH token | Standard text                                        | Depends on explicit policy; none for a passive placeholder |

DASH and NA are named product states, not hard-coded global string detection. The column defines the exact text, such as `-`, `NA` or `N/A`. Applicability and interaction rules determine behavior; a coincidental matching string must not determine renderer type.

Non-finite numbers and malformed input need an explicit feature policy. They must not silently become NA or zero.

## 6. Preparation and renderer selection

### 6.1 Grid display flow

1. AG Grid obtains the value through the column's dedicated getter.
2. The preparation adapter receives that value, the row, column identity and current feature context.
3. It evaluates the column's content, marker, permission and control rules. Source-dependent checks read row fields through the feature's explicit mapping.
4. It selects standard rendering or the appropriate custom renderer.
5. For custom rendering, it passes plain prepared presentation state and the required operational callbacks.

Use `cellRendererSelector` as the selection point. Its selected result can supply renderer params, so features do not need to repeat the same preparation separately in both selector and `cellRendererParams` callbacks. Avoid configuring a fallback custom `cellRenderer` that would defeat the standard-rendering branch. Verify this integration against the installed AG Grid version.

If selection chooses standard rendering, the column's `valueFormatter`, alignment/classes and native tooltip settings provide the standard display. Number formatting and unit resolution must use the same definitions as the custom path. A custom renderer is unnecessary merely to format a number or show plain text.

### 6.2 Selection contract

| Prepared requirements                                 | Selection                                           |
| ----------------------------------------------------- | --------------------------------------------------- |
| Text, number or placeholder with no custom capability | Standard AG Grid cell                               |
| Marker, no editing or control                         | Text/number renderer with marker                    |
| Configured popover edit action                        | Popover renderer                                    |
| Configured dialog edit action                         | Dialog renderer                                     |
| Toggle control                                        | Toggle renderer                                     |
| Dropdown control                                      | Dropdown renderer, with its existing popover editor |
| Feature-defined composite control                     | Feature renderer, such as toggle-number             |

A missing-required cell selects its editing renderer even though its value is empty. The warning does not grant permission. A non-applicable cell does not inherit editing or a missing-value marker from an unrelated rule.

Native grid tooltips can remain on standard cells. A custom marker or interactive tooltip may require custom rendering. Tooltip presence alone is not a universal custom-renderer condition.

### 6.3 Prepared params contract

The adapter supplies separate prepared categories for content, marker, action and controls. The renderer keeps explicit Angular `computed()` signals named `cellContent`, `cellMarker`, `cellAction` and the corresponding control categories.

Prepared state is transient. It can be discarded when the grid refreshes or virtualizes a cell. It is not stored back in the row or used as an independent business source of truth.

Column rule configuration and prepared renderer params should have distinct types. Rule-bearing fields belong to column configuration. Prepared fields contain evaluated results. Operational callbacks remain functions. Renderer-specific types must preserve the editor component/data relationship and reject an edit action without its required editor.

Absent `action` means no pen. Disabled content styling does not itself deny editing. Toggle/dropdown control permission remains distinct from the optional pen action, as in the current kit.

## 7. Plain values and functions

| Configuration       | Plain value example                                        | Function example                                                        | Evaluation time                                |
| ------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------- |
| Number options      | Locale, two decimals, grouping enabled                     | Only if the feature actually varies an option per cell                  | Preparation                                    |
| Unit                | `kg`                                                       | Unit read from row metadata                                             | Preparation and export                         |
| Alignment/highlight | End alignment, highlight off                               | Highlight when a related row condition applies                          | Preparation                                    |
| Marker              | Fixed marker presentation                                  | Warning based on the source field and requiredness                      | Preparation                                    |
| Permission          | Constant permission                                        | Permission from current row/workflow                                    | Preparation; recheck on save                   |
| Editor component    | Component class                                            | No factory needed for a fixed editor type                               | Configuration                                  |
| Editor data         | Fixed data only for an editor with no cell-dependent input | Fresh source value and row-bound save callback                          | Editor opening                                 |
| Popover options     | Width, position, backdrop; default trigger anchor          | Anchor or options that require the actual open context                  | Editor opening                                 |
| Dialog options      | Fixed width and options                                    | No expansion of the current contract needed without a concrete use case | Editor opening                                 |
| Dropdown options    | Fixed list                                                 | List based on current row, where supported by its contract              | Preparation/opening as required by the control |
| Dropdown popover    | Fixed override or omit for defaults                        | No additional function configuration needed for current behavior        | Editor opening                                 |
| Save                | None                                                       | Commit the draft through feature persistence                            | Submission                                     |
| Equality            | Default `Object.is`                                        | Compare option objects by stable ID                                     | Change detection                               |

Use plain objects for fixed popover options. The host already has the trigger for default anchoring. A function is justified when the result depends on the opening context, not simply because the presentation is a popover.

Keep numeric formatting under `content.number` and the hosted editor under `action.editor`. Formatting contributes to content; the editor implements the action.

The current shared `formatNumber` calculation can serve standard formatting, preparation and tests. An Angular pipe may wrap it for Angular templates. A pipe does not replace the shared calculation because standard AG Grid formatting and export preparation also need formatting outside templates.

## 8. Editor lifecycle and commits

1. The user activates an allowed action/control.
2. The renderer supplies the editor host with the trigger and originating cell identity.
3. The editor data factory looks up the latest canonical row by identity and prepares the raw editable source value. It must not reuse a stale presentation snapshot as authoritative input.
4. The editor owns its draft and validation.
5. The save operation rechecks current permission and commits through feature persistence.
6. The feature updates canonical rows and synchronizes the grid.
7. Presentation refresh follows the dependency policy below.

The existing host retains presentation ownership, dismissal, focus restoration and cleanup. Dropdown already uses a popover; users of dropdown need only optional presentation overrides.

## 9. Refresh and dependency behavior

Moving preparation into grid callbacks makes refresh coordination explicit. Angular signals inside a renderer do not detect arbitrary mutation of a row object. Prepared plain values also do not independently subscribe to changes in another row.

AG Grid normally uses value change detection during `refreshCells`. An unchanged resolved value can leave a changed marker or permission untouched. Use a forced refresh when presentation dependencies change. See [AG Grid view refresh](https://www.ag-grid.com/angular-data-grid/view-refresh/).

The feature must refresh after successful commits that affect presentation. Initially, refresh all rendered cells of the affected table with `force: true` after synchronizing the dataset. This is a conservative correctness policy for cross-row and cross-column rules. Later, explicit dependency groups can limit the affected columns and rows.

Do not infer dependencies by inspecting callback bodies. Keep getters and rules pure, use stable row IDs, and expose the latest dataset to each evaluation. If a value cache is enabled, invalidate it when its inputs change. A presentation refresh alone does not recalculate filtering, sorting or aggregate models; those updates follow the feature's row-model integration.

Renderer selection and functional params participate in renderer creation and applicable refresh work. They are not subscriptions to row fields. The integration must verify standard-to-custom, custom-to-standard and custom-type transitions against AG Grid 36.2. Prefer `refreshCells`; use targeted redraw if a required component transition cannot be handled by refresh.

Rows outside the viewport receive current state when created. Export evaluates its requested dataset directly and does not depend on whether cells have rendered. Missing `params.data`, group rows and loading rows require explicit feature handling before row-field rules run.

Column-definition changes use AG Grid's column update path. View-only settings that affect formatting require presentation refresh but do not become stored business values.

## 10. Excel export

### 10.1 Semantic parity

"Same value as the grid" means the same resolved value and empty/applicability policy. It does not mean copying formatted DOM text.

| Source and policy                      | Grid display                   | Excel value cell                                  | Excel unit cell |
| -------------------------------------- | ------------------------------ | ------------------------------------------------- | --------------- |
| Amount `1250.5`, unit kg, two decimals | `1,250.50 kg`                  | Numeric `1250.5`, number format with two decimals | Text `kg`       |
| Null, DASH policy                      | Configured DASH text           | Same text                                         | Blank           |
| Null, NA policy                        | Configured NA text             | Same text                                         | Blank           |
| Null, missing-required policy          | Blank with warning/edit action | Blank                                             | Blank           |
| Zero, normal numeric policy            | Formatted zero with unit       | Numeric `0`                                       | Configured unit |
| Zero, DASH policy                      | Configured DASH text           | Same text                                         | Blank           |

Warnings, pen buttons and editor state are UI presentation and do not change the exported value. Exported numbers retain their underlying precision; number formats control visible decimals. Text sentinels remain text cells, never forced into numeric types.

### 10.2 Export schema

For every numeric column declared to have a unit, export its value column followed immediately by its unit column. The column definition declares this capability and provides a shared unit value/rule. A currently empty dataset must not remove the unit column from the schema.

The same unit definition feeds grid presentation and export. Units default to blank for missing values and placeholders. Inline unit visibility is a separate display choice and does not remove the Excel unit column.

The export projection owns headers, stable export column IDs and number formats. Preserve the requested value-column order and insert each unit next to its value. Build this schema without changing the user's displayed grid columns.

### 10.3 Export evaluation

Export obtains values through the same dedicated getters or AG Grid's getter-backed value path. It must not recreate the business calculation in an export-specific function. The export adapter needs an explicit current row/dataset context for getters that depend on other rows.

AG Grid Excel export uses getter values, does not use renderer output and applies value formatters by default. The integration must explicitly preserve numeric types when display formatters include units. See [AG Grid Excel export](https://www.ag-grid.com/angular-data-grid/excel-export/) and [export customization](https://www.ag-grid.com/angular-data-grid/excel-export-customising-content/).

Adding adjacent unit columns needs a concrete export-schema implementation. A `processCellCallback` alone only changes a cell's content. Choose and verify the workbook/export integration during implementation; this specification does not claim the current exporter already inserts those columns.

The table specifies export scope, such as filtered/sorted rows, selected rows or the complete dataset. Virtualization must not limit export. Server-backed tables need to obtain the full requested scope before projecting it. Export evaluates one consistent committed dataset; unsaved editor drafts are excluded.

## 11. Sorting, filtering and aggregation

Returning placeholders from getters produces mixed numeric/text column values. Preserve this supported design, but configure its data operations explicitly.

- Numeric sorting must define where DASH, NA and blank appear relative to numbers.
- Filtering must preserve each placeholder's intended meaning and retain numeric comparison for numbers.
- Aggregation must include numeric values and explicitly exclude placeholders. Never coerce a placeholder to zero as an accidental fallback.
- Excel formulas receive genuine numbers for valid numeric cells and text/blank for the corresponding grid states.

If mixed values make the required grid operations too costly or awkward, a future alternative is a strictly numeric getter plus separate display-state policy. That changes which value AG Grid sees and therefore requires a deliberate migration of filtering, export and empty-state semantics. It is not part of this proposal.

## 12. Implementation sequence

1. Identify each feature's grouped getters, source-field mappings and shared applicability/requiredness helpers. Record existing outputs before changing wiring.
2. Introduce distinct column-rule and prepared-renderer contracts. Keep `content.number`, `action.editor` and renderer-specific control contracts.
3. Add the preparation adapter and explicit standard/custom selector. Move business presentation evaluation out of custom renderers.
4. Integrate forced presentation refresh after committed dataset changes. Cover unchanged-value and cross-row dependencies before optimizing refresh scope.
5. Add export schema/projection with adjacent unit columns and preserved numeric types.
6. Migrate demo configurations, use plain popover options where they are fixed, and correct the `showUnits` setting's name or remove it.
7. Update the as-built documentation only after implementation and verification.

The first implementation should use the existing renderer set, formatter, editor host and feature persistence. Add abstractions only where they remove duplicated column wiring or enforce a contract above.

## 13. Acceptance criteria

- Existing dedicated getters remain the only definition of resolved values.
- Source-input warnings use row fields; calculated-value warnings use their declared inputs. A placeholder alone does not imply a warning.
- Shared applicability/requiredness conditions have one definition, even when multiple callbacks evaluate them.
- DASH, NA and passive blank cells create no custom renderer. Ordinary number formatting can also use standard rendering.
- Missing-required cells render a warning and their configured editor action. Permission denial blocks activation and save.
- Numeric formatting works in decorated and editing renderers through `content.number`; editor configuration stays under `action.editor`.
- Editors open with fresh source values and save to the originating identity through feature persistence.
- Metadata-only changes update markers and permissions with an unchanged getter value.
- Cross-column/cross-row changes update dependent values and presentation, including after virtualization.
- Standard/custom renderer transitions work with the installed grid version.
- Excel contains the same placeholder/blank semantics as the grid, numbers remain numeric and unit columns follow their value columns.
- Export schema stays stable when all values are missing, and export includes all rows in its requested scope.
- Sorting, filtering and aggregation have verified behavior for mixed number/placeholder values.
- Keyboard activation, dismissal, focus restoration and disabled behavior pass the relevant browser tests, Axe checks and WCAG AA requirements.

Verify these through pure rule tests, adapter tests with actual grid lifecycle coverage, workbook value/type inspection and focused browser accessibility tests. Documentation-only changes do not require rerunning application tests.
