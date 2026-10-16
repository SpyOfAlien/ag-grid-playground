# Cell kit usage

Import grid renderers, category types, editors and EditorHostService from [public-api.ts](../src/app/shared/grid-cells/public-api.ts). The reusable [editor host](../src/app/shared/grid-cells/editing/editor-host/public-api.ts) and standalone [app popover](../src/app/shared/popover/public-api.ts) also have separate entry points.

[Design](ag-grid-cell-kit-design.md) explains ownership and types. [Flows](cell-kit-flows.md) traces opening and save methods. Examples linked below are checked by npm run test:types, including Angular templates. They are consumer fixtures, not routed application pages.

## Application setup

Use the repository's compatible Angular 21, Material/CDK 21 and AG Grid Enterprise dependencies. Register AG Grid modules and the Enterprise license before creating a grid. The kit does not register modules or supply a license. The demo's [grid-registration.ts](../src/app/shared/ag-grid/grid-registration.ts) is the application example.

Load CDK overlay styles in angular.json:

```json
"styles": ["node_modules/@angular/cdk/overlay-prebuilt.css", "src/styles.scss"]
```

Load the global cell layout and your Material theme. The repository uses:

```scss
@use '@angular/material' as mat;
@use './app/shared/grid-cells/styles/cell-layout';

html {
  @include mat.theme(
    (
      color: (
        primary: mat.$cyan-palette,
      ),
      typography: Arial,
      density: -2,
    )
  );
}

* {
  box-sizing: border-box;
}
```

Give the grid a height and add `grid-kit-cell` to each custom renderer column's cellClass. This removes the grid's extra padding while the renderer reserves 24px per side. Keep row and column virtualization enabled.

Configure provideHttpClient at application level for server persistence. Feature persistence, state and EditorHostService belong on the owning table component. NgRx is optional; an immutable store can own canonical replacement rows without changing the presentation contracts.

## Display-only cells

A display-only table needs no editing providers. Choose a renderer and a specific params type:

```ts
const params = {
  content: {
    alignment: 'end',
    tooltip: ({ value }) => String(value ?? ''),

    number: { decimals: 2, useGrouping: true, unit: ({ data }) => data?.unit ?? null },
  },
} satisfies NumberCellParams<Row>;

const columns: ColDef<Row>[] = [
  {
    field: 'amount',
    cellClass: 'grid-kit-cell',
    ...bindCellRenderer(NumberCell<Row>, params),
  },
];
```

NumberCell omits the unit for empty/non-finite values and includes it for zero. TextCell accepts ContentPart and MarkerPart, without numeric formatting or edit actions. Content ellipsis defaults to true; set content.ellipsis=false only where overflow is intentional. A tooltip is configured separately and does not require a marker.

Import `bindCellRenderer` from the public entry point. It infers the configuration from the chosen renderer's `agInit` params, including custom renderers. Specialize generic components with your row and value types, such as `NumberCell<Row>` or `DropdownCell<Row, Row['unit']>`. Inline callbacks then receive those types without a separate `satisfies` declaration. The helper checks renderer configuration; AG Grid still owns the column's field and value getter contract.

Use a fixed binding when the renderer is the same for every row. It creates the binding once per column without a selector callback or selector-result allocation per cell. Use `cellRendererSelector` when the renderer actually varies by row. Leave ordinary columns on AG Grid's normal rendering path. Keep column definitions/configs stable instead of rebuilding them on every render.

A provider-free Angular example is [DisplayExample](../type-tests/docs/usage-example/usage-example.ts). [DisplayGridExample](../type-tests/docs/signal-presentation-example.ts) shows declarative keyboard setup; SignalPresentationExample in the same file shows a signal-reading unit rule.

## Markers and permissions

A constant or a CellContext callback can configure each marker:

```ts
const markers = {
  error: { when: ({ value }) => value != null && value < 0, tooltip: 'Amount cannot be negative' },
  userEdited: { when: isUserEdited, tooltip: 'Edited by a user' },
  systemGenerated: { when: true, tooltip: 'Calculated by the system' },
} satisfies MarkerPart<Row, number>['markers'];
```

`isUserEdited` is application logic. Only the highest matching marker appears, with Error, Warning, userEdited, systemGenerated, Info, then special priority. The demo's cached placeholder predicate is not a production audit policy.

For a pen editor, add action config explicitly:

```ts
const action = {
  tooltip: 'Edit amount',
  permission: ({ data }) =>
    data?.reviewed
      ? { allowed: true }
      : { allowed: false, reason: 'Review this row before editing.' },
} satisfies ActionPart<Row, number>['action'];
```

Without action, a pen renderer has no pen. Setting action.enabled=false removes it. Denied permission keeps a disabled pen with its reason, and activation is guarded. Content disabled styling is independent from permission. Persistence must also authorize against its current rows.

## A small editable table

The complete [AmountTableExample](../type-tests/docs/amount-table-example/amount-table-example.ts) provides EditorHostService, [RowState](../type-tests/docs/row-state.ts) and [ApiExample](../type-tests/docs/api-example.ts) on the owning component. Its template uses one rowData binding:

```html
<ag-grid-angular
  style="height: 400px"
  [context]="context"
  [rowData]="state.rows()"
  [columnDefs]="columns"
  [getRowId]="getRowId"
  (rowDataUpdated)="onRowsUpdated($event)"
/>
```

The context is `{ editorHost: this.host }`, and getRowId returns data.id. Columns use withCellKeyboardColumns for keyboard composition. An explicit onRowsUpdated handler force-refreshes rendered rows for metadata-only changes after a bound dataset update. There is no runtime integration directive. The example's amount configuration is:

```ts
readonly amountParams = {
  content: { alignment: 'end' },
  action: {
    tooltip: 'Edit amount',
    permission: ({ data }) =>
      data?.reviewed
        ? { allowed: true }
        : { allowed: false, reason: 'Review this row before editing.' },

    editor: {
      component: InputEditor<number>,
      data: (cell) => {
        if (!cell.rowId) throw new Error('Missing row.');
        const identity = { rowId: cell.rowId, columnId: cell.columnId };
        return {
          initialValue: cell.value ?? null,
          config: { label: 'Amount', mode: 'number', validators: [Validators.min(0)] },
          save: (value) =>
            this.persistence.saveAmount({
              cell: identity,
              data: { value },
              queryParams: { source: 'amount', include: ['totals', 'status'] },
            }),
        };
      },

      popover: ({ trigger }) => ({
        anchor: { kind: 'element', element: trigger },
        placement: 'bottom',
        width: 320,
      }),
    },
  },
} satisfies PopoverCellParams<Row, number, InputEditorData<number>>;
```

Select PopoverCell with these params on the amount column. The pen opens the host, the editor initializes its Material field, and Save calls ApiExample.saveAmount. That action checks the current row permission, constructs an HTTP payload/query, validates the complete returned rows and publishes RowState. The rowData binding updates the grid; the editor closes after the save promise fulfills. A rejected request leaves the draft open for retry.

This small HTTP example illustrates the binding path. The feature implementation below supplies dataset reset protection, serialized requests, revisions and durable feedback for tables with those requirements. Use only one synchronization path per table.

## Field editor and presentation choices

| Choice       | Configuration                                                                                                     |
| ------------ | ----------------------------------------------------------------------------------------------------------------- |
| Text input   | InputEditor<string> with InputEditorData<string>, initialValue string or null, config.mode='text'                 |
| Number input | InputEditor<number> with InputEditorData<number>, initialValue number or null, config.mode='number'               |
| Textarea     | TextareaEditor with TextareaEditorData, initialValue string, optional rows/maxLength                              |
| Popover      | PopoverCellParams<R,V,D>, action.editor component/data factory, optional action.editor.popover options or factory |
| Dialog       | DialogCellParams<R,V,D>, action.editor component/data factory, optional action.editor.dialog options              |

Field config requires a label. Validators and asyncValidators are optional. Invalid or pending validation blocks Save. Generic editors use Material fields/buttons; the host adds no action footer.

PopoverCell and DialogCell accept the same content.number configuration as NumberCell when their value type is numeric:

```ts
content: {
  number: { locale: 'en-US', decimals: 2, unit: ({ data }) => data?.unit ?? null },
},
```

The displayed text includes the unit, while the editor receives the raw number. Unit rules can read signals and update the existing cell without a grid refresh. Missing or non-finite numeric values display empty text and skip the unit rule.

Without content.number configuration, these cells prefer valueFormatted and fall back to String(value). For custom text or an object summary, use content.text, a string or a callback receiving CellContext. This replaces the former display callback and also works in TextCell and NumberCell. In numeric content, content.text skips numeric formatting for finite values; missing or non-finite values remain empty. The unit rule still supplies the unit field in NumberContentState for consumers that render it separately.

Popover options include element/point anchor, twelve placements, title, width/height and maximum dimensions. Numeric dimensions mean pixels. The pen is the default grid anchor. App popovers support click-point fallback separately; grid editor configuration does not need it.

Editor popovers default to a dismissible backdrop and blocked background scrolling. Set action.editor.popover.scrollable=true to allow scrolling and repositioning. Set backdrop=false for no backdrop or closeOnBackdropClick=false for a persistent backdrop. Escape always closes. Dialogs accept title/dimensions/backdrop options and always block background scrolling. Both presentations allow internal content scrolling and trap focus.

Cancel, Escape and dismissible backdrop clicks discard unsubmitted drafts without a common confirmation prompt. Closing after submission does not cancel the feature action. See [editor host](editor-host.md) for focus, lifetime and failure behavior.

## Inline toggle and dropdown

Configure direct control saves against feature actions:

```ts
const toggle = {
  toggle: {
    save: (value, cell) => actions.saveEnabled({ cell: identity(cell), data: { value } }),
  },
} satisfies ToggleCellParams<Row>;

const dropdown = {
  dropdown: {
    options: [
      { value: 'kg', label: 'Kilograms' },
      { value: 't', label: 'Tonnes' },
    ],
    save: (value, cell) => actions.saveUnit({ cell: identity(cell), data: { value } }),
  },
} satisfies DropdownCellParams<Row, Row['unit']>;
```

Here identity validates rowId and returns rowId/columnId. The complete callbacks and row types are in [public-api-usage.ts](../type-tests/public-api-usage.ts).

ToggleCell uses one native switch button and saves immediately. DropdownCell uses one native trigger and opens Material options on demand in the custom popover. Selection saves and closes on success. It retains the committed selection during pending work or failure. Outside click and Escape close the dropdown; it has no Cancel button or trailing radio button.

Control permission can be configured in toggle.permission or dropdown.permission and overrides action.permission. Content styling remains separate. Object-valued dropdown options can provide equals; options can be individually disabled.

## Feature client/server setup

The demo feature defines explicit actions through DEMO_TABLE_PERSISTENCE. It has two concrete implementations. Choose one on the owning component:

```ts
providers: provideDemoServerEditing();
// or
providers: provideDemoClientEditing(); // transaction
// or
providers: provideDemoClientEditing('mutation');
```

These helpers belong to the demo feature, not the shared kit. An application defines its own feature token/actions/state and can use the same EditorHostService and EditCommand<T> contracts.

[ClientTableExample](../type-tests/docs/client-editing-example.ts) connects the grid on gridReady and supplies context, a typed amount editor and stable getRowId:

```ts
onGridReady(event: GridReadyEvent<DemoRow>): void {
  this.table.connectGrid(event.api);
}
```

```html
<ag-grid-angular
  [context]="context"
  [gridOptions]="gridOptions"
  (gridReady)="onGridReady($event)"
/>
```

There is no rowData binding in this connected setup. Connection initializes rows; state commits own subsequent synchronization. The same setup can use the server provider. connectGrid returns a disconnect function for an independently removed grid. Feature destruction also disconnects it.

Transaction commits send complete affected replacement rows through one applyTransaction call, verify the result and publish canonical replacements. Mutation commits assign into owned current row objects, refresh model/cells and publish a new array. Choose transaction for immutable stores and NgRx. Mutate only feature-owned copies. Both strategies preserve unrelated rows and refresh all affected columns for metadata-dependent markers/permissions.

Server actions validate full replacement or upsert responses and update the table through its connected state. They serialize dataset-replacing requests, reauthorize current rows, check revisions/generation and retain completion feedback after dismissal. A full response can remove the edited row or return an empty dataset. Query arrays become repeated keys. Client actions use no HTTP and ignore HTTP-only query params. See [feature persistence](feature-persistence.md).

## Custom editors and composite cells

Implement HostedEditor<D> with a required data signal input. Define your own opening data, form and persistence action list. Initialize forms in ngOnInit after the host binds data. Inject EditorRef, await a committed feature save and then call close(). Handle rejection in the editor so users can retry. A field's configured validator list is not required for a complex editor.

[DetailsEditor](../src/app/features/grid-demo/editors/details-editor.ts) is the complete Material example. Its opening data includes cell identity, initial name/amount/notes, revision and query params. It chooses saveDetails or approveDetails, which can call different endpoints. The shared host does not need to know those actions.

[ExampleOwner](../type-tests/docs/editor-host-example.ts) demonstrates opening a typed editor outside a renderer with the same host. [complex-actions.ts](../type-tests/docs/complex-actions.ts) checks feature action commands and successful close.

For a new composite renderer, extend BaseCell with a specific intersection of param categories. Declare independent cellContent, cellMarker, cellToggle and cellAction computed state and apply capability directives to its native elements. [ToggleNumberCell](../src/app/features/grid-demo/cells/toggle-number/toggle-number-cell.ts) combines a switch and number pen without nesting renderer components. [Its params](../src/app/features/grid-demo/cells/toggle-number/toggle-number-cell-params.model.ts) reuse ContentPart, TogglePart and ActionPart with a typed PopoverEditorConfig.

## Signal-driven presentation

Keep presentation signals separate from schema and grid context. Read them inside params rules or a renderer display callback:

```ts
readonly currency = signal('USD');
readonly amountParams = {
  content: {
    number: { decimals: 2, unit: () => this.currency() },
  },
} satisfies NumberCellParams<Row>;
```

The renderer's cellContent computation tracks this read. Changing currency updates its Angular template without refreshing AG Grid or rebuilding columns. A static unit: currency() value is a snapshot. Callback rules must be synchronous and side-effect free. See the [compile-checked example](../type-tests/docs/signal-presentation-example.ts) and [integration guide](cell-kit-integration.md).

## Verification and troubleshooting

Run npm run test:types after changing public types or consumer examples. It checks positive examples, expected type rejections and Angular templates. Build validates the application. Unit/browser suites cover presentation, persistence and renderer behavior.

If a pen is missing, check action presence/enabled state. If activation throws, check that context.editorHost comes from the owner component. If metadata is stale after direct mutation, force-refresh the affected row nodes. If a client save rejects as out of sync, check getRowId, the connected grid and whether a second rowData binding replaced canonical references.

Keep dated baseline reports unchanged. [Historical measurements](measurements.md) indexes their environments and recorded results; they are not current production performance guarantees.
