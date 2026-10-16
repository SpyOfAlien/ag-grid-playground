# Grid cells refactor

Applied on 2026-10-16 to the 37 improvements from that day's design review of `src/app/shared/grid-cells`. The project uses Angular 21 and AG Grid 36.2.0. The [usage guide](cell-kit-usage.md) describes the resulting API.

## Outcome by item

| #   | Improvement                                       | Result                                                                                                                                                                            |
| --- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Toggle/dropdown title bound twice                 | Fixed. `cellContent` sits on a wrapper; the control directive owns the button's title. Regression test: a locked toggle with a content tooltip shows "Locked".                    |
| 2   | Pending toggle save lost on scroll                | Fixed when the grid context provides `CellOperations`, which keys save state by cell. Test recreates the renderer mid-save. The demo provides it.                                 |
| 3   | Toggle failure not announced                      | Fixed through the CDK `LiveAnnouncer`, so cells add no live regions.                                                                                                              |
| 4   | Every pen named "Edit value"                      | Fixed: "Edit {header}", overridable with `action.label`. The e2e locator changed to "Edit Review + amount".                                                                       |
| 5   | Backdrop click discards dirty drafts              | Added as an opt-in: `closeOnBackdropClick: 'when-clean'`. The default still discards, because the design docs and an e2e test specify that behavior. See [Decisions](#decisions). |
| 6   | Arrow keys trapped on buttons                     | Fixed. Navigation keys stay with inputs, selects, textareas, contenteditable and slider/listbox-like roles only.                                                                  |
| 7   | Reselecting the current option did nothing        | Fixed: it closes without saving. Material emits no change for the selected option, so `DropdownOptions.confirm` handles click, Enter and Space.                                   |
| 8   | Empty dropdown label                              | Fixed with the `dropdownPlaceholder` label default.                                                                                                                               |
| 9   | Invalid `decimals` threw                          | Clamped to 0–100. An invalid locale falls back to the runtime locale.                                                                                                             |
| 10  | Number cells ignored custom text for empty values | `content.text` now applies to every value in every renderer. This intentionally changes the earlier tested behavior.                                                              |
| 11  | Duplicated editor launching                       | `openCellEditor` and `openDropdownEditor`.                                                                                                                                        |
| 12  | Duplicated save lifecycle                         | `trackSave`, used by the toggle, the composite and all three editors.                                                                                                             |
| 13  | Controls re-templated per renderer                | `button[cellToggle]` and `button[cellDropdown]` directives. Toggle and dropdown styles moved to the shared stylesheet.                                                            |
| 14  | Save state owned by renderers                     | `CellOperations` in `GridContext`, with at most 256 retained failures.                                                                                                            |
| 15  | Three permission sources with fallbacks           | Cell-wide `editable`; a control's own `permission` replaces it for that control. The composite still needs different toggle and pen rules, so per-control overrides remain.       |
| 16  | Ignored action settings accepted                  | Toggle and dropdown params no longer include `ActionPart`. A type test rejects `action` on a toggle.                                                                              |
| 17  | Two identical editing renderers                   | `PopoverCell` and `DialogCell` merged into `EditCell` with `action.editor.presentation: { kind, options }`.                                                                       |
| 18  | Only the top marker described                     | `MarkerState.additional`. All active markers appear in the aria-label and tooltip; the top marker is drawn.                                                                       |
| 19  | Cell context rebuilt per capability               | `toCellContext` is memoized per params snapshot and revalidated against in-place changes. A typed `BaseCell` computed was tried, but the generic params prevented inference.      |
| 20  | Formatter key built on every call                 | `WeakMap` by config object, with the bounded string-keyed cache as fallback. In-place config changes are detected.                                                                |
| 21  | Split config from row facts in `BaseCell`         | Not done. Item 20 already caches config-derived work, and splitting signals would miss in-place config mutation, which the kit supports and tests.                                |
| 22  | Renderer-free read-only cells                     | Opt-in `bindPlainCell`. Not adopted in the demo; measure first.                                                                                                                   |
| 23  | Many tiny files                                   | 67 kit source files became 40: one file per capability and per renderer.                                                                                                          |
| 24  | Deep imports from features                        | `@grid-cells` and `@grid-cells/composition` path aliases. `scripts/check-grid-cells-imports.mjs` runs in `test:types` and fails on internal paths.                                |
| 25  | Mixed public API                                  | `public-api.ts` for column wiring; `composition-api.ts` re-exports it and adds the building blocks.                                                                               |
| 26  | Duplicated field editors                          | `FieldEditor` base class plus one shared stylesheet.                                                                                                                              |
| 27  | Repeated error text expression                    | `errorMessage`.                                                                                                                                                                   |
| 28  | Hard-coded colors                                 | CSS custom properties with the previous values as fallbacks, documented in `cell-layout.scss`.                                                                                    |
| 29  | Hard-coded strings                                | `GRID_CELL_LABELS` and `provideGridCellLabels`.                                                                                                                                   |
| 30  | String selection index                            | Number.                                                                                                                                                                           |
| 31  | Missing host found on click                       | In development builds, editing renderers throw when the grid first renders them.                                                                                                  |
| 32  | Redundant tabindex, dead `dirty`                  | Removed.                                                                                                                                                                          |
| 33  | Closed marker kinds                               | Augmentable `MarkerKinds` and `provideGridCellMarkers`. Configured kinds without a definition are kept at lowest priority.                                                        |
| 34  | Closed presentation kinds                         | Augmentable `EditorPresentations`, `EditorPresentationAdapter` and `provideEditorPresentations`. The popover and dialog are now adapters.                                         |
| 35  | Number special-cased                              | `content.format` formatter; `content.number` stays as the built-in numeric formatter.                                                                                             |
| 36  | `injectCellParams()` instead of `BaseCell`        | Not done. AG Grid calls `agInit`/`refresh` on the component, so a function hook would still need those methods in every renderer, which adds code rather than removing it.        |
| 37  | Value type not tied to renderer                   | `cellColumn<Row>()(Renderer, { field or valueGetter, params })`. Type tests reject a string field for `NumberCell` and a numeric getter for `TextCell`.                           |

## Decisions

- **Backdrop clicks still discard by default (item 5).** [The renderer spec](cell-renderer-system-spec.md), [flows](cell-kit-flows.md) and `e2e/field-editors.spec.ts` specify outside-click discard. The first implementation guarded dirty editors by default, and that e2e test failed, so the guard became an opt-in rather than a silent behavior change.
- **Editor `data` still receives `CellContext`.** Passing the open context there was not a review item and broke existing callers, so it was reverted.
- **Breaking API changes.** `PopoverCell`/`DialogCell` became `EditCell`. `editor.popover`/`editor.dialog` became `editor.presentation`. `DropdownState.label` (the selection) became `text`, and `label` is now the accessible name. Toggles and dropdowns no longer fall back to `action.permission`. Every consumer in this repository was migrated.

## Size

Kit TypeScript grew from 1,756 to 2,359 lines across fewer files. The growth comes from new capabilities: shared save state, presentation adapters, the marker registry, labels, the column helpers and the control directives. Duplicated renderer and editor code was removed.

## Verification

- Unit suite: 264 tests passed across 39 files, compared with the 233-test baseline.
- Type suite: TypeScript contracts, including new column and marker-augmentation contracts, plus Angular doc examples, passed. The import-boundary check passed and was shown to fail on a deep import.
- Production build: passed.
- Browser suite: all 78 Playwright tests passed, including the Axe scans in the grid, editor and composite specs.
- The demo grid was checked visually after the control styles moved to the shared stylesheet. The console showed only AG Grid's trial-license notice.
