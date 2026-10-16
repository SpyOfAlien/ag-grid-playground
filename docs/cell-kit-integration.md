# Grid integration and signal-driven presentation

The cell kit uses ordinary AG Grid bindings. Configure keyboard behavior once, provide a stable editor-host context for editing, and let renderer computations read application presentation signals. There is no runtime grid integration directive or automatic row-reference observer.

Import supported code from `src/app/shared/grid-cells/public-api.ts`.

## Stable columns and reactive cell state

```ts
readonly currency = signal('USD');
readonly amountParams = {
  content: {
    alignment: 'end',

    number: { decimals: 2, unit: () => this.currency() },
  },
} satisfies NumberCellParams<Row>;

readonly columns = withCellKeyboardColumns<Row>([
  {
    field: 'amount',
    cellClass: 'grid-kit-cell',
    cellRendererSelector: () => ({ component: NumberCell, params: this.amountParams }),
  },
]);
```

```html
<ag-grid-angular [columnDefs]="columns" [rowData]="rows" [getRowId]="getRowId" />
```

The column array and params object are stable. The unit rule reads currency when NumberCell's cellContent computation evaluates it. Changing currency invalidates that computation without replacing columns, updating grid context, recreating renderers or calling refreshCells. Angular updates the content through its normal signal/template behavior. Independent categories remain cached until one of their own dependencies changes.

The example displays a code suffix; it does not convert amounts. Use a display callback and a feature formatter for locale-specific currency formatting.

Rules execute synchronously and return values. They can read application signals, but do not write signals, call HTTP, subscribe, or open editors. A rule called outside a reactive consumer is an ordinary calculation. Do not wrap presentation reads in untracked().

Read signals inside the callback, not during column construction. `unit: () => currency()` is reactive; `unit: currency()` captures the current value. Conditional reads create conditional dependencies. An empty numeric cell skips its unit rule; if it later gains a value through a grid update, it reads the current unit setting.

Existing number locale/decimals/grouping options remain static. The migration does not add a signal type to every category field. Callback-capable fields, including content.text and content.number.unit, support signal-reading calculations.

## Keyboard configuration

[withCellKeyboardColumns](../src/app/shared/grid-cells/integration/cell-keyboard.ts) walks the column array and nested groups. It combines the kit's control behavior with application keyboard callbacks. Apply it once when building definitions, including when a schema change creates a new array.

```ts
readonly defaults = withCellKeyboard<Row>({
  sortable: true,
  suppressKeyboardEvent: applicationKeyboardRule,
});
readonly columns = withCellKeyboardColumns<Row>(createColumns(), this.defaults);
```

Pass defaultColDef as the helper's second argument when its application keyboard callback must be inherited by columns without an explicit callback. Explicit column callbacks retain AG Grid's override semantics. Application and kit suppression combine with logical OR. The application callback executes once even when the kit handles the key. Applying the helpers again to composed definitions does not nest wrappers.

With no application default callback, the single-argument column helper is sufficient. If every column relies on the default keyboard rule, withCellKeyboard can configure defaultColDef alone. Columns with explicit overrides must still be composed.

The existing native-control rule handles activation/navigation keys within controls and Tab inside composite cells. AG Grid owns movement between cells. Configuration helpers add no DOM elements or grid subscriptions.

## Context and editor ownership

Provide EditorHostService on the component that owns the table and bind a stable context:

```ts
providers: [EditorHostService]

private readonly host = inject(EditorHostService);
readonly context = { editorHost: this.host } satisfies GridContext;
```

```html
<ag-grid-angular [context]="context" [columnDefs]="columns" [gridOptions]="options" />
```

GridContext contains only an optional editorHost. Applications can extend context with stable service references. Presentation rules can capture application signal references directly; changing a display preference does not require replacing context.

Renderers call context.editorHost.open. Editors call feature persistence. Each table can have its own host while its rules read a shared settings signal. Owner-scoped host destruction handles editor cleanup; presentation rules require no manual subscription teardown.

## Row commits and metadata refresh

Signals update Angular presentation, not AG Grid's data model. BaseCell still receives row/value changes through agInit or refresh and returns true from refresh to retain the instance.

Connected tables let their feature commit implementation update grid data, expire value caches and refresh the affected rows. This is the demo's path. Do not also bind rowData for those same commits.

A simple rowData-bound table can handle accepted datasets explicitly:

```ts
onRowsUpdated(event: RowDataUpdatedEvent<Row>): void {
  event.api.refreshCells({ rowNodes: event.api.getRenderedNodes(), force: true });
}
```

```html
<ag-grid-angular
  [context]="context"
  [rowData]="state.rows()"
  [columnDefs]="columns"
  [getRowId]="getRowId"
  (rowDataUpdated)="onRowsUpdated($event)"
/>
```

The handler refreshes visible presentation when unchanged displayed values have new metadata. It has one purpose and no subscription registry. Newly rendered off-screen cells initialize with current data. In-place metadata mutation still requires an explicit feature refresh of affected row nodes.

Sorting, filtering, grouping, aggregation, exports and AG Grid value formatters are separate model/configuration concerns. If those depend on an application setting, update them explicitly; a renderer signal alone does not recalculate the grid model. Display-disabled state also does not replace persistence authorization.

## Reactive schemas and saved column layout

Use computed column definitions when the schema genuinely changes, such as adding/removing columns or changing a header. Keep params calculations that read presentation signals inside stable callback objects. Reapply the keyboard helper to each new schema and keep context independent.

Backend width, visibility, order and pinning preferences are column state. Restore them through applyColumnState with stable column IDs rather than rebuilding the schema for every resize. Persist user changes through feature-owned settings handlers. Prevent restoration from being saved back as a new user edit.

Export-only projections can split an amount and unit into separate workbook columns without adding hidden grid columns. Export selection/order can derive from the grid's logical column state. Export settings persistence and workbook generation belong to the application, not cell presentation.

Compile-checked examples: [signal-presentation-example.ts](../type-tests/docs/signal-presentation-example.ts), [AmountTableExample](../type-tests/docs/amount-table-example/amount-table-example.ts), and [ClientTableExample](../type-tests/docs/client-editing-example.ts). See [editor ownership](editor-host.md) and [feature persistence](feature-persistence.md).
