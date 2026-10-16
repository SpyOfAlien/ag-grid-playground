# Feature persistence

Feature persistence owns edit intent, authorization, payload construction, transport and committing returned data. Editors call its business actions directly. The shared command is an envelope for data; it carries no executable operation or update instruction.

```ts
interface EditCommand<T> {
  readonly cell: { readonly rowId: string; readonly columnId: string };
  readonly data: T;
  readonly queryParams?: HttpQueryParams;
}
```

The contract is in `src/app/shared/grid-cells/editing/edit-command.model.ts`. Column identity identifies the originating control. The feature action chooses the endpoint and payload rather than treating columnId as a backend property.

## Demo server setup

Provide server editing at the table component:

```ts
@Component({
  providers: provideDemoServerEditing(),
  // ...
})
export class FeatureTable {
  private readonly persistence = inject(DEMO_TABLE_PERSISTENCE);
  readonly table = inject(DemoTableState);
}
```

`provideDemoServerEditing` supplies the state, editor host, server persistence and feature token. `DEMO_TABLE_PERSISTENCE` aliases that table's DemoServerPersistence instance. HttpClient/interceptors remain application configuration.

## Actions and payloads

```ts
await persistence.saveAmount({
  cell: { rowId: 'row-00001', columnId: 'metric-2' },
  data: { value: 12.5 },
  queryParams: { source: 'amount-column', include: ['totals', 'status'] },
});
```

The feature supports saveName, saveAmount, saveNotes, saveReview, saveUnit, saveDetails and approveDetails. Scalar actions build field payloads from the latest row. They preserve unrelated metrics and metadata. Amount edits accept zero and null; present amounts must be finite and non-negative.

Details actions receive name, amount, notes and the opening numeric revision. They enforce the current revision and the demo's required-field rules before sending. saveDetails uses PATCH to the details endpoint. approveDetails sends the current details draft with POST to the approval endpoint. The server remains responsible for atomic revision checks across other clients.

Query parameters support scalar values and arrays; arrays become repeated HTTP query keys. Details actions send the checked revision, overriding a conflicting caller-provided revision query.

## Save execution

The execution path stays inside the feature:

```text
DemoServerPersistence.saveAmount(command)
  -> snapshot intent and enter the feature queue
  -> read current row and authorize the action
  -> build payload and issue HttpClient request
  -> validate the response and dataset generation
  -> DemoTableState.commitServerUpdate
  -> publish completion and resolve
```

All actions share one FIFO queue because any response can replace the dataset. A queued action reads the row after earlier commits, including its latest review state and revision. Failure does not block later actions. Each action captures the command and query arrays at submission, so caller mutations cannot change queued work.

## Authoritative updates

The demo response model belongs to the feature. A replace-rows response replaces the entire dataset, removes omitted rows, and may remove the edited row or return an empty dataset. An upsert-rows response replaces matching IDs, appends new rows and retains omitted rows. Invalid or duplicate IDs fail before state changes. These server actions reject a single-row patch response.

Accepted responses commit through DemoTableState's single grid synchronization path. On a connected demo table, the state expires grid cache, replaces rowData, force-refreshes returned nodes and then publishes canonical rows. Dataset generation does not increase. The save promise resolves after the commit; Angular view rendering follows its normal render cycle.

A server-only application can instead bind its canonical rows through rowData. [AmountTableExample](../type-tests/docs/amount-table-example/amount-table-example.ts) demonstrates this choice. Do not also issue transactions for the same bound commit. Both server and client demo providers use the connected setup described below, without a rowData binding.

## Reset, destruction and feedback

An unrelated reset increments dataset generation and dismisses the owner's active editor. This prevents an old opening draft from targeting a replacement dataset with reused IDs. Pending and queued work cannot commit to that new generation. Feature destruction settles callers even if the transport later returns, and late responses cannot change state.

Dismissal alone discards the unsubmitted draft. It does not cancel a submitted feature action. `pending()` counts active and queued work; `completion()` retains only the latest originating cell/action and success or failure. It does not retain full response datasets. Failures therefore remain observable after their editor closes.

The implementation is in `src/app/features/grid-demo/demo-server-persistence.ts`. Behavior tests are in `demo-server-persistence.spec.ts`; production action types are checked by `type-tests/editing-redesign/server-feature.ts`.

## Client setup

Client editing uses the same `DEMO_TABLE_PERSISTENCE` token and typed action methods. Select the update strategy in table component providers:

```ts
providers: provideDemoClientEditing(); // transaction is the default
// or
providers: provideDemoClientEditing('mutation');
```

Connect the grid once when it becomes ready:

```ts
readonly table = inject(DemoTableState);
readonly gridOptions: GridOptions<DemoRow> = {
  getRowId: ({ data }) => data.id,
  columnDefs: [{ field: 'name' }],
};

onGridReady(event: GridReadyEvent<DemoRow>): void {
  this.table.connectGrid(event.api);
}
```

```html
<ag-grid-angular [gridOptions]="gridOptions" (gridReady)="onGridReady($event)" />
```

The feature owns this connected grid's row data. Do not also bind `rows()` to `[rowData]` or synchronize it from an effect. Connection initializes the dataset; reset and authoritative responses replace it through the same feature-owned path. Ordinary client edits update only affected rows. `connectGrid` returns a disconnect function for an independently removed grid; table destruction also disconnects it. A destroyed grid can be replaced with a new connection.

The complete editable Angular example is compile-checked in [client-editing-example.ts](../type-tests/docs/client-editing-example.ts). Switching its provider to provideDemoServerEditing uses the same connected grid setup. The feature requires a client-side row model, registered AG Grid modules and stable IDs through `getRowId`.

## Client commits

`DemoClientPersistence` reads the latest row, authorizes the action and validates the draft. Private feature intent functions are shared with server actions. The local calculation normalizes fields, increments revision and recalculates the dependent row. It uses no HTTP request and ignores HTTP-only query parameters.

The transaction strategy creates complete replacement rows, preserves their IDs and replaces changed nested objects. `DemoTableState.commitClientRows` performs one `applyTransaction({ update: affectedRows })` and publishes the resulting canonical rows once. Unaffected row references remain stable. The returned transaction is checked before the promise resolves.

The mutation strategy assigns the calculated fields into the current feature-owned row objects and publishes a new array through the state signal. Existing row references stay stable while changed metrics and metadata objects are replaced. Reset and server response inputs are copied into feature ownership, so mutation cannot change the original supplied dataset. State is exposed through a read-only signal and rows have read-only consumer types. Components must not modify these references directly.

Direct mutation is only appropriate for this mutable feature-owned state. An application using immutable state or NgRx must use the transaction strategy and commit replacements through its state management rules. Never mutate an NgRx entity in place.

Both strategies expire the value cache, recalculate grouping, filtering, aggregation and sorting, and force-refresh every column in affected rows. Row-wide refresh is deliberate: metadata can affect markers and permissions beyond the edited column. Dependent rows are included. These refresh operations follow AG Grid's [transaction update](https://www.ag-grid.com/javascript-data-grid/data-update-transactions/) and [value cache](https://www.ag-grid.com/javascript-data-grid/value-cache/) behavior.

Client work completes synchronously before returning its fulfilled promise; `pending()` therefore remains zero. Failures reject the promise and publish the same durable completion feedback as server saves. Missing rows, stale revisions, denied actions and disconnected/destroyed grids cannot commit. An incomplete transaction or refresh failure restores the previous grid data and mutated references before rejecting, without publishing new canonical state.

Behavior tests in `demo-client-persistence.spec.ts` exercise both strategies against real AG Grid instances, including dependent calculations, frozen input data, cached values, grouping/aggregation, filtering/sorting, metadata permissions, rejected updates and recovery.

## Demo runtime selection

`provideDemoEditing()` provides both real persistence implementations and one shared state/editor host. `GridDemo.persistence` selects client or server from the table mode. Column save closures call the selected implementation directly. The mode control cannot change while an editor is open or a server action is pending.

`DetailsEditor` injects the configured feature contract. In the runtime demo it can select the additionally provided server implementation directly when server mode is active. In a table with only client or server providers, the configured feature contract is sufficient. The editor builds its own typed draft command for save or approval; it does not construct row patches or invoke a generic submission service.

The ordinary amount action edits metric 2. When it originates in `toggle-number`, the feature edits metric 7 and uses that metric for dependent recalculation. `applyReviewDemo` is a client-only demonstration action that changes the material name, first measurement and unit. Its permission is checked in the renderer and client persistence.
