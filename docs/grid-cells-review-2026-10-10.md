# Grid cells review

Reviewed the working tree on 2026-10-10, including the existing uncommitted migration to `content.number` and `action.editor`. The project uses Angular 21 and AG Grid 36.2.0.

## Assessment

Keep the existing architecture. `BaseCell` adapts grid refreshes into a signal. Pure `compute*` functions resolve each capability, and renderers compose those capabilities with native elements and small directives. Independent computed signals let marker, content and permission rules track different application signals. Editors mount on demand through a host owned by the table.

This supports composition without nesting entire cell renderers or putting every capability in one base class. New renderers can reuse the capability types and calculations while retaining explicit `computed()` declarations. The signal and DOM-retention tests verify that changes to presentation settings do not require rebuilding columns or calling grid refresh.

## Changes made

| Finding | Change | Evidence |
| --- | --- | --- |
| `ToggleNumberCell` calculated content styling through both `computeContent` and `computeNumberContent`. | Use one numeric content computation for both styling and text. | A regression test verifies one shared content-rule evaluation on initialization and one after its signal changes, retaining the span. |
| Custom numeric text still ran number formatting before replacing the result. | Call `formatNumber` only when custom text is absent. Preserve empty-value handling and the independently exposed unit. | A regression test verifies custom text avoids formatter construction, and normal numeric content still uses it. |
| Every keyboard event enumerated controls and read their layout. | Return immediately for unrelated keys. Activation/navigation keys inspect only the target control. Reserve visibility scanning for Tab. Recognize events from control descendants. | Tests verify no control-list scans or layout reads for ordinary and activation keys, plus forward/backward Tab boundaries and hidden/disabled controls. |
| Fixed renderer selectors allocated a selection object per cell, while AG Grid's renderer config fields erased type checks. | Add `bindCellRenderer(Component<Row>, config)` and migrate the demo's fixed choices and a compiled usage example. | Type tests reject missing saves, unsupported capabilities, invalid rule values, wrong dropdown values and incompatible editor data. Browser tests exercise all demo bindings. |
| `withCellKeyboard` discarded the column's value generic. | Preserve `ColDef<R, V>` through the helper. | A type test rejects a string value getter on a numeric column after wrapping. |

## Using the typed binding

```ts
const column: ColDef<Row, number> = {
  field: 'amount',
  cellClass: 'grid-kit-cell',
  ...bindCellRenderer(NumberCell<Row>, {
    content: {
      number: { decimals: 2, unit: () => currency() },
    },
  }),
};
```

The helper derives configuration from the component's `agInit` parameter. It also works with custom `BaseCell` subclasses; there is no renderer registry to extend. Specialize generic components before binding. Existing params objects checked with `satisfies` remain supported. Use `cellRendererSelector` when renderer choice genuinely depends on the row.

When specifying both row and value types for keyboard configuration, use `withCellKeyboard<Row, number>(column)`. An unspecified value type now defaults to `unknown` rather than inheriting AG Grid's `any` default.

## Constraints retained

- Keep the shallow params snapshot on every grid refresh. Rows and nested config can change in place, so reference equality or comparison of only `value` would miss metadata changes. Regression tests cover this behavior.
- Keep separate computed signals for independent capabilities. Do not combine marker and permission work into content computation merely to share one object.
- Keep presentation rules synchronous and free of side effects. Signal reads inside those rules participate in the renderer's computation. Angular documents this behavior in its [signals guide](https://angular.dev/guide/signals).
- Keep persistence and editor lifetime outside the virtualized renderer. Existing browser tests cover saves that continue after the editor closes.
- Keep the bounded formatter cache. No unbounded per-row cache or extra effect/subscription was added.

## Limits and next decisions

The binding helper checks the renderer/config relationship. It does not prove that an AG Grid `field` or `valueGetter` produces the renderer's declared value type. AG Grid's ordinary column definition still permits untyped renderer wiring. A future column builder could own both value extraction and renderer choice if complete column-level inference is required. The existing column-system design proposal remains a separate change.

The performance evidence here is reduced work and retained DOM, not a measured FPS or large-dataset timing improvement. The browser suite uses the small showcase and a narrow viewport for virtualization. Historical 1,000-row/200-column measurements remain historical. A new production workload benchmark would be needed before setting a frame-time target.

The production build also reports a 2.81 MB shared lazy chunk before compression. That is a separate loading-cost question from cell rerender cost; dependency/module selection should be profiled before changing it.

AG Grid documents fixed renderers, selectors, refresh behavior and custom keyboard responsibilities in its [cell components guide](https://www.ag-grid.com/angular-data-grid/component-cell-renderer/).

## Verification

- Unit suite: 233 tests passed across 37 files, compared with the 228-test baseline.
- Type suite: TypeScript contracts and Angular consumer templates passed.
- Production build: passed, with a 283.67 kB initial bundle before compression.
- Selected browser suite: 15 tests passed across direct controls, signal presentation, composite cells, showcase and Material editors. Included Axe scans reported no violations on the tested pages and editor states.
- `git diff --check`: passed.

The local browser server required execution outside the sandbox. Two sandboxed production builds aborted without diagnostics; the production build succeeded outside the sandbox. Existing unrelated working-tree changes were preserved.
