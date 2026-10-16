# Signal-driven cell presentation migration

This is a historical plan. The current API nests numeric formatting in `content.number` and hosted editor configuration in `action.editor`. See [cell kit usage](cell-kit-usage.md) for current examples.


Status: complete. All six phases are implemented and verified.

## Objective

Keep column definitions and editor-host context stable while application presentation signals update dependent Angular cell computations. Remove the runtime CellKit directive and its grid-event observation. Keep row commits and AG Grid model updates explicitly owned by the feature.

The renderer library remains the cell kit. Removing the CellKit integration directive does not remove the renderers, capability directives, BaseCell, editor host, or persistence implementations.

## Architecture decision

The existing NumberCell, TextCell, PopoverCell, DialogCell, ToggleCell, DropdownCell and composite renderer calculate category state with Angular computed(). Their compute functions synchronously evaluate CellRule callbacks. A signal read inside such a callback participates in the surrounding computation's dependency tracking.

The current integration directive subscribes to gridReady, installs model/component-state listeners, increments a revision signal, compares visible row references, and requests forced refreshes. Feature grid commits already refresh affected rows. Replace this overlapping ownership with two explicit paths:

1. Application presentation changes invalidate the renderer computations that read the changed signals.
2. Row commits update the grid through the feature's transaction, mutation, or dataset replacement implementation, including any required metadata refresh.

Alternatives considered:

| Approach                                      | Caller responsibility                                                    | Decision                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Runtime directive observes grid events        | Configure directive inputs and understand its automatic refresh behavior | Remove; refresh ownership overlaps feature commits                         |
| Explicit refresh on every presentation change | Maintain the list of dependent columns and request refreshes             | Use only for AG Grid-owned behavior; unnecessary for Angular display state |
| Signal-reading presentation rules             | Pass synchronous calculations that read application signals              | Adopt; dependencies are expressed where the displayed state is calculated  |

No generic signal registry, invalidation bus, per-cell subscription, or new table facade is required.

## Caller usage

Columns are ordinary stable definitions. A rule captures a signal reference rather than the value produced while building columns.

```ts
readonly currency = signal('USD');
readonly context = { editorHost: this.host } satisfies GridContext;

readonly amountParams = {
  content: { alignment: 'end' },
  number: {
    decimals: 2,
    useGrouping: true,
    unit: () => this.currency(),
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
<ag-grid-angular
  [context]="context"
  [columnDefs]="columns"
  [gridOptions]="options"
  (gridReady)="onGridReady($event)"
/>
```

This example displays a currency code suffix. It does not convert amounts or implement locale-specific currency formatting. Real currency formatting can use a renderer's existing display callback and a formatter owned by the feature.

Calling currency.set('EUR') leaves the column array, params objects, context object, renderer instances, and grid model unchanged. Dependent renderer computations recalculate when consumed by Angular, and their templates update. Independent category computations keep their cached state. New virtualized renderer instances read the current settings when created.

Do not snapshot a signal into a static field such as unit: currency(). Do not read presentation signals while building a computed columns array unless the column definitions themselves must change.

## Contracts and module structure

Keep the existing rule and lifecycle types:

```ts
export type CellRule<R, V, T> = T | ((cell: CellContext<R, V>) => T);

export interface GridContext {
  readonly editorHost?: EditorHostService;
}
```

Keep explicit independent renderer computations:

```ts
readonly cellContent = computed(() => computeNumberContent(this.params()));
readonly cellMarker = computed(() => computeMarker(this.params()));
```

Rules return values synchronously. They may read signals, but do not write state, perform HTTP requests, create subscriptions, or open editors. Read application signals during the rule execution, without untracked(). Outside an Angular reactive consumer, the same compute functions remain ordinary calculations with no automatic updates.

Do not add Signal<T> alternatives to every params category or create a combined presentation state model. Existing value-or-callback fields are sufficient. Number locale, decimals and grouping remain static in this migration; making additional fields reactive requires a separate typed design. Existing display callbacks can read signals when dynamic formatting is needed.

Proposed public keyboard helper signatures:

```ts
export function withCellKeyboard<R>(definition: ColDef<R>): ColDef<R>;

export function withCellKeyboardColumns<R>(
  definitions: (ColDef<R> | ColGroupDef<R>)[],
  defaults?: ColDef<R>,
): (ColDef<R> | ColGroupDef<R>)[];
```

The column helper walks groups and applies keyboard composition to leaf definitions. Its optional second argument supplies defaultColDef keyboard behavior to columns without an explicit override; this preserves inheritance when composing every leaf. It preserves application callbacks and returns unchanged definitions where already composed. The defaults helper supports callers that only configure defaultColDef. Using both must not nest the kit rule repeatedly. Application and kit decisions combine with logical OR, and the application callback still executes once per keyboard event.

Cache/wrapper identity handling, if required for safe repeat composition, stays private to these functions. The helpers have no grid instance, subscriptions, effects, DOM nodes, or teardown. Dynamic column changes are explicitly passed through the same helper when the feature creates the new definitions.

Target files:

```text
src/app/shared/grid-cells/
  core/
    base-cell.ts                         # unchanged lifecycle
    cell-context.model.ts                # unchanged CellRule
    grid-context.model.ts                # stable editor-host context
    suppress-cell-control-keyboard.ts    # existing keyboard behavior
  integration/
    cell-keyboard.ts                     # public configuration helpers
    cell-keyboard.spec.ts
  capabilities/                         # existing category calculations/directives
  renderers/                            # existing independent computed state
  public-api.ts

src/app/features/grid-demo/
  grid-demo.ts                           # presentation signal, stable context/columns
  grid-demo.html                         # ordinary AG Grid bindings
  demo-columns.ts                        # rules read presentation signals
  demo-grid-updates.ts                    # existing explicit data/model refresh owner

type-tests/
  cell-keyboard-contracts.ts
  docs/signal-presentation-example.ts

docs/
  cell-kit-integration.md                # direct setup and update ownership
  cell-kit-signal-driven-plan.md
```

Delete integration/cell-kit.ts and the CellKit/CellKitContext public exports after all consumers migrate. Replace the integration-only parts of cell-kit.spec.ts with coverage of the new public interface. Retain meaningful keyboard tests.

## Refresh ownership

| Change                                                                                      | Required path                                                                                                   |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Signal read by cell content, marker, permission or dropdown label/options                   | Angular recomputes dependent renderer state; no grid refresh solely for that presentation change                |
| Transaction, direct mutation, or backend dataset replacement                                | Feature commit updates canonical rows, grid data/model/cache as needed, and refreshes affected row presentation |
| In-place row metadata mutation                                                              | Feature explicitly force-refreshes the affected rows; there is no reference-change observer                     |
| New column definitions, headers, visibility, or other AG Grid configuration                 | Feature updates the corresponding grid input/API; cell signals do not configure the grid                        |
| Sorting, filtering, aggregation, export or native grid value formatting depends on settings | Feature explicitly updates the AG Grid-owned behavior; Angular cell computations alone do not update it         |

Keep the connected-grid path in the demo. Do not additionally bind rowData there.

Documentation examples that use rowData binding need a clear metadata refresh owner once the directive is removed. Where AG Grid's normal value comparison is insufficient, use a single explicit rowDataUpdated template handler to force-refresh rendered row nodes after accepting the new dataset. This local handler has one purpose and needs no subscription registry. Do not also attach it to connected tables whose commits already refresh.

A signal-driven disabled action is presentation state, not backend authorization. Persistence must continue checking business permission at save time. Do not change existing command, validation, FIFO, generation, or dismissal behavior as part of this migration.

## Implementation phases

### Phase 1: Prove renderer dependency tracking

- [x] Add Angular renderer tests with signal-reading content/unit, marker and action rules using existing types.
- [x] Change a presentation signal without agInit/refresh, grid API calls, or new columns; verify the rendered text/attributes update.
- [x] Verify renderer and native element identity remain stable and independent computation categories are not recalculated by unrelated signals.
- [x] Cover conditional dependencies, empty values with omitted units, and destroyed/new renderer lifetimes.
- [x] Retain tests of agInit/refresh for row/value updates.

Completion: actual renderer DOM demonstrates automatic signal updates, rather than only testing standalone computed values.

### Phase 2: Extract declarative keyboard configuration

- [x] Implement and export withCellKeyboard and withCellKeyboardColumns in cell-keyboard.ts.
- [x] Preserve default and explicit per-column rules, nested groups, callback invocation, repeat composition, and newly supplied definitions.
- [x] Keep the current keyboard behavior for buttons, switches, dropdowns and composite cells.
- [x] Add public-interface unit and strict type tests.
- [x] Keep the existing directive temporarily until its consumers migrate.

Completion: keyboard setup works without runtime event observation.

### Phase 3: Migrate the small demo

- [x] Give GridDemo a stable context containing its editor host and stable keyboard-composed columns.
- [x] Remove CellKit imports, cellKit attributes and cellKitContext bindings.
- [x] Remove setMode's context replacement and presentation refresh when the existing save callback already reads the persistence signal at activation/save time; first verify no other consumer requires demoPersistenceMode.
- [x] Add a small Show units presentation signal/control. Pass its signal reference to the demo column factory and read it in numeric unit/display calculations, including the composite cell. Keep each row's original unit when enabled; do not change stored values.
- [x] Keep table-scoped services and explicit gridReady connection.
- [x] Audit demo-grid-updates to preserve metadata refresh after all commit strategies.
- [x] Add browser coverage proving settings changes update cells with stable column definitions and renderer elements, and that new virtualized renderers read current settings.

Completion: the demo has no integration observer and still supports all edit types, reset, client commits and server recalculation.

### Phase 4: Migrate contracts/examples and remove the observer

- [x] Update all type-tests/docs consumers, including amount-table-example, client-editing-example and cell-kit-example, to direct context bindings and keyboard helpers.
- [x] Supply explicit metadata refresh in rowData-bound examples where needed; retain one synchronization path per table.
- [x] Replace CellKit/CellKitContext type tests with keyboard and signal-rule contracts.
- [x] Delete the runtime CellKit directive, its private keyboard class and obsolete observer tests/exports once unused.
- [x] Remove visible-row maps, revision counters and integration subscriptions instead of moving them to another service.

Completion: no active source, template, public contract or compile-checked example depends on the deleted directive.

### Phase 5: Update reader-facing documentation

- [x] Rewrite cell-kit-integration.md for stable context, keyboard helpers, signal-driven rules and explicit data refresh ownership.
- [x] Update ag-grid-cell-kit-design.md, cell-kit-flows.md, cell-kit-usage.md and README with matching examples and responsibilities.
- [x] Explain static column params versus signal-reading callbacks, conditional signal dependencies, and the distinction between Angular presentation and the AG Grid model.
- [x] Keep historical plans and performance records intact; add a superseded note where a prior plan describes the removed directive as the current approach.
- [x] Check documentation links and compile its TypeScript and Angular examples.

Completion: current guides explain the final design without relying on conversation history.

### Phase 6: Verify completion

- [x] Run build, test:types, test:unit and the browser suite.
- [x] Verify keyboard navigation, disabled reasons, focus restoration, Escape, outside dismissal and existing overlay accessibility checks.
- [x] Verify client transaction/mutation, server row-set replacement, unchanged-value metadata updates, errors after dismissal, reset races and ownership cleanup.
- [x] Verify presentation signals update dependent rendered cells without recreating columns or renderers or calling refreshCells solely for that change.
- [x] Verify unrelated category computations stay cached and no always-present DOM wrappers are added.
- [x] Verify shared presentation signals work across two mounted table owners without sharing editor hosts. Do not add another permanent demo route.
- [x] Record results and remaining limitations in this plan.

Completion: all required checks pass and every active integration uses the new ownership model.

## Execution rules

Implement one phase at a time. Keep TypeScript strict, category params composable, renderer computed state explicit, and component fields in the required declaration order. Keep the application compiling at phase boundaries. Do not broaden this work into editor factories, persistence redesign, NgRx adoption, currency conversion, a general reactive column builder, backend layout persistence, or workbook generation.

The renderer tests proved the proposed synchronous signal paths participate in dependency tracking. No replacement refresh observer was introduced.

## Completion record

Completed on 2026-10-06.

- Phase 1: four Angular renderer tests verify content/marker/action updates without refresh, stable native elements, independent computation caching, conditional dependencies, empty values, shared settings across separate editor-host owners, destruction and new renderer initialization.
- Phase 2: public keyboard helpers replace the runtime keyboard class. Five tests cover nested groups, repeat composition, application callbacks, default inheritance, explicit overrides and native-control activation. Composed functions use a private marker rather than a WeakSet/WeakMap cache registry.
- Phase 3: the demo binds a stable host context and keyboard-composed columns. Show units drives numeric display rules, including popover and composite content. Persistence mode is read by save callbacks; switching it does not update context or force cells to refresh. Existing feature commit implementations retain affected-row refresh.
- Phase 4: the directive, its private keyboard class, observer-only tests and public exports are deleted. Strict contracts and compiled examples use direct bindings and explicit metadata refresh where appropriate.
- Phase 5: current design, flow, usage, integration and README guides describe the new ownership. Historical plans have a superseded integration note; measurement records are unchanged.
- Phase 6: production build and strict TypeScript/Angular template checks pass. All 208 unit tests pass, followed by a focused rerun of the four renderer tests after strengthening actual editor-host ownership coverage. All 33 Chrome browser tests pass, including accessibility checks and three new signal-presentation scenarios. Browser API observation confirms Show units changes invoke neither refreshCells nor columnDefs updates. New virtualized composite renderers read current presentation state. Data commits still refresh. Formatting, whitespace and active-guide local link checks pass.

The library adds no resting renderer wrappers. Presentation-only changes do not recalculate AG Grid sorting, filtering, aggregation or export values. Static number formatting options remain static; dynamic display callbacks can read application settings. Backend column-layout persistence and Excel projections are documented application concerns, not implementations added by this migration.
