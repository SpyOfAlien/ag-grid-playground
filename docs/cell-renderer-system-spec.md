# Cell renderer system design specification

This is an as-built specification of the current source, inspected on 2026-10-06. It describes implemented contracts, runtime behavior and integration requirements. Source code and executable examples are the authority; this document is not an implementation roadmap.

## 1. Purpose and scope

The system supplies composable Angular cell renderers for AG Grid, native resting controls, typed on-demand editors and reusable editor presentation. Application features own business validation, persistence, canonical row data and grid synchronization.

The package manifest declares Angular 21.2, Angular Material/CDK 21.2.14 and AG Grid Angular/Community/Enterprise 36.2.0. Renderer components are standalone, use OnPush change detection and native Angular template control flow. Angular signals hold lifecycle params and local UI state.

The system contains no generic backend endpoint protocol, global table-state store, Excel projection engine, native AG Grid cell-editor implementation or universal column builder. The demo's persistence providers and composite renderer are feature examples, not shared-kit contracts.

## 2. Ownership and module map

| Module                | Owns                                                                                                  | Does not own                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Application table     | Columns, row IDs, editor-host provider scope, presentation settings, chosen grid synchronization path | Renderer-internal category calculations          |
| BaseCell              | AG Grid agInit/refresh bridge and params signal                                                       | Forms, presentation lifetime, data commits       |
| Category calculations | Content, marker, permission and control state derived from params and synchronous rules               | Subscriptions, HTTP, state writes                |
| Capability directives | Classes, attributes, tooltips and styles on native elements                                           | Cell lifecycle or persistence                    |
| Specific renderer     | Template composition, independent category computations, activation                                   | Business payload policy or backend selection     |
| Keyboard helpers      | Composition of native-control and application keyboard callbacks                                      | Runtime grid observation                         |
| EditorHostService     | One active editor per owner, mounting, child injector, presentation dismissal and focus restoration   | Draft validation, commands or row reconciliation |
| Hosted editor         | Draft, validation, pending/error UI, selection of save action                                         | Universal grid data management                   |
| Feature persistence   | Current-row authorization, business validation, HTTP/local calculation and committed updates          | Overlay geometry or renderer DOM                 |
| PopoverService        | CDK positioning, focus trap, arrow, background scrolling and overlay cleanup                          | Business saves or table state                    |

Supported imports:

- [grid-cells/public-api.ts](../src/app/shared/grid-cells/public-api.ts) exposes renderers, category contracts/calculations/directives, BaseCell, keyboard helpers, editors and shared editor-host contracts.
- [editor-host/public-api.ts](../src/app/shared/grid-cells/editing/editor-host/public-api.ts) is the editing host entry point; its presentation contracts do not depend on AG Grid.
- [popover/public-api.ts](../src/app/shared/popover/public-api.ts) exposes standalone popover behavior.

The entry points are conventions for supported imports. The repository contains source files rather than an independently enforced package boundary.

```text
src/app/shared/
  grid-cells/
    core/                lifecycle, identity/context, rules, keyboard behavior
    capabilities/        content, marker, action, number, toggle, dropdown
    renderers/           text, number, popover, dialog, toggle, dropdown
    editing/             typed edit command, editor host and generic field editors
      editor-host/       owner-scoped presentation service and editor contracts
    integration/         column keyboard configuration functions
    styles/              shared native cell layout
    public-api.ts
  popover/               standalone connected overlay implementation
  overlay/               shared Escape and background-scroll handling

src/app/features/grid-demo/
  demo-columns.ts        feature renderer/editor wiring
  demo-table-state.ts    canonical rows and dataset generation
  demo-*-persistence.ts  named feature actions
  demo-grid-updates.ts   connected-grid transaction/mutation/replacement
  editors/               complex details form
  cells/toggle-number/   feature composite renderer
```

## 3. Core types and lifecycle

[CellContext and CellRule](../src/app/shared/grid-cells/core/cell-context.ts) isolate the row/value information needed by category rules:

```ts
interface CellContext<R, V> {
  readonly rowId: string | undefined;
  readonly columnId: string;
  readonly data: Readonly<R> | undefined;
  readonly value: V | null | undefined;
}

type CellRule<R, V, T> = T | ((cell: CellContext<R, V>) => T);

interface CellOpenContext<R, V> extends CellContext<R, V> {
  readonly trigger: HTMLElement;
}
```

CellContext's Readonly type is shallow. It does not clone/freeze the row or guarantee an immutable snapshot. [toCellContext](../src/app/shared/grid-cells/core/cell-context.ts) uses node.id for row identity, then column.getColId(), colDef.colId or colDef.field for column identity. Column identity falls back to an empty string. Feature save code must reject unusable identities.

GridContext contains an optional EditorHostService reference. The renderer's runtime params are AG Grid params intersected with the renderer-specific configuration:

```ts
interface GridContext {
  readonly editorHost?: EditorHostService;
}

type RendererParams<R, V, C> = ICellRendererParams<R, V, GridContext> & C;
```

[BaseCell](../src/app/shared/grid-cells/core/base-cell.ts) implements ICellRendererAngularComp. agInit and refresh both shallow-copy the incoming params into a private signal. The protected params signal starts as null. refresh always returns true, allowing the existing Angular renderer to update. Nested row/config objects remain referenced. A different renderer selected by AG Grid still requires AG Grid to manage that renderer lifecycle.

Renderers declare separate computed state, for example:

```ts
readonly cellContent = computed(() => computeNumberContent(this.params()));
readonly cellMarker = computed(() => computeMarker(this.params()));
```

There is no combined computed state object for every category and no runtime grid-integration directive.

## 4. Renderer configurations

Category interfaces are combined through intersections. The following table summarizes actual accepted categories; it is not a new universal params type.

| Renderer     | Value type | Configuration                                                             | Resting content                   |
| ------------ | ---------- | ------------------------------------------------------------------------- | --------------------------------- |
| TextCell     | string     | ContentPart + MarkerPart                                                  | One text span                     |
| NumberCell   | number     | ContentPart + MarkerPart                                                  | One formatted span                |
| EditCell     | generic V  | ContentPart + MarkerPart + EditablePart + ActionPart with optional editor | Text span and optional pen        |
| ToggleCell   | boolean    | ContentPart + MarkerPart + ActionPart + required TogglePart               | Native switch button              |
| DropdownCell | generic V  | ContentPart + MarkerPart + ActionPart + required dropdown config          | Native button with selected label |

ToggleCell and DropdownCell accept ActionPart for permission fallback; they do not render a pen or use action.enabled to remove their direct control. Their control-specific permission takes precedence over action.permission.

The feature [ToggleNumberCell](../src/app/features/grid-demo/cells/toggle-number/toggle-number-cell.ts) combines a native switch, number span and optional pen using independent computations. It does not nest ToggleCell and NumberCell components. Its params intersect the required capability contracts plus a popover editor config. A nested content container is used for its switch/number arrangement.

### 4.1 Content

ContentConfig contains optional number formatting for numeric value types and supports rule-valued text, alignment, highlighted, disabled and tooltip fields; ellipsis is a static boolean. Defaults are start alignment, no highlight, no disabled styling, ellipsis enabled and no tooltip.

[CellContent](../src/app/shared/grid-cells/capabilities/content.ts) adds classes, text alignment and a native title attribute to its target. Content disabled means muted styling; it does not independently prevent editing.

Text calculation uses content.text when configured, including for null values. Otherwise it returns an empty string for a null/undefined raw value, then uses content.format, then valueFormatted, and falls back to String(value). TextCell and EditCell share this calculation. EditCell accepts content.number for numeric value types and use computeNumberContent when it is configured. Without content.number, they retain the text fallback. Custom text belongs in content.text; the former renderer-level display callback is removed.

NumberConfig supports static locale, decimals and grouping, plus a rule-valued unit. [computeNumberContent](../src/app/shared/grid-cells/capabilities/number.ts) rejects non-number and non-finite values as empty, does not evaluate their unit and preserves zero as a value. Valid values use Intl.NumberFormat and append a nonempty unit with a space. An explicit content.text overrides the text for every value, including invalid numeric values, as in text cells. Decimals are clamped to 0–100 and an invalid locale falls back to the runtime locale. NumberCell and numeric EditCell share this behavior. Editors always receive the raw value. [formatNumber](../src/app/shared/grid-cells/capabilities/number.ts) caches at most 128 formatter instances.

### 4.2 Marker

Markers are a partial record of kind to a when rule and optional tooltip rule. [computeMarker](../src/app/shared/grid-cells/capabilities/marker.ts) orders active markers by the registered priority, which defaults to:

```text
error > warning > userEdited > systemGenerated > info > special
```

The highest-priority marker is drawn; the others are returned as `additional` and included in the accessible label and tooltip. Kinds are augmentable through `MarkerKinds`, with order and labels from `provideGridCellMarkers`. Marker symbols use CSS pseudo-elements: red error, yellow warning, blue user-edited dot, purple system-generated dot, information symbol and black special-case square. CellMarker adds role=img, a descriptive aria-label and native title tooltip. The kit does not infer whether a value was edited or system-generated; configured rules decide.

### 4.3 Action and permission

EditPermission is `{ allowed: true }` or `{ allowed: false; reason: string }`. [computePermission](../src/app/shared/grid-cells/capabilities/permission.ts) denies cells without usable row identity or row data before evaluating the supplied rule; otherwise it defaults to allowed.

ActionPart groups enabled, permission, tooltip, label and the renderer-specific editor under action. A control's own permission replaces the cell-wide `editable` rule for that control only. EditCell and ToggleNumberCell require action.editor whenever action is configured. Omitting action gives a display-only cell. Direct controls keep their own save callbacks. An absent action or enabled=false gives a hidden pen. A denied permission leaves a disabled pen with the denial reason as its tooltip. CellEditAction uses aria-disabled rather than the native disabled attribute, keeps the button keyboard-focusable and guards activation. The renderer repeats the activation check before opening.

Permission shown by a renderer is UI state. Feature persistence must authorize again against current data before saving.

## 5. Layout, tooltips and keyboard behavior

[Shared layout CSS](../src/app/shared/grid-cells/styles/cell-layout.scss) requires grid-kit-cell on the AG Grid cell. It clears AG Grid's cell padding; the renderer host supplies 24px padding on each inline side. Marker and pen are absolutely positioned, physically left/right respectively, 4px from their side, outside content flow.

The marker box is 16px wide. The pen button is 16px wide and 24px high. The pen is transparent and ignores pointer events until the cell is hovered or the button has visible keyboard focus. It remains a focusable element while hidden. Content shrinks and truncates through min-width:0 and ellipsis classes. The sample app globally enables border-box sizing and imports this stylesheet.

Tooltips use native title attributes; no Material tooltip overlay is created per resting cell. Native title alone is not a custom keyboard/touch tooltip interaction contract. Marker aria-labels and pen labels provide separate accessibility information.

[withCellKeyboardColumns](../src/app/shared/grid-cells/integration/keyboard.ts) is called when definitions are built. It recursively composes leaf callbacks without mutating input definitions. Its optional defaultColDef argument supplies inherited application callbacks to leaves without explicit callbacks. withCellKeyboard can configure a default definition alone. Already composed callbacks carry a private Symbol marker, preventing repeated wrapping.

Application suppression and kit suppression combine with logical OR; the application callback executes once even if the kit handles the key. Explicit column callbacks override application default callbacks rather than combining both application callbacks.

The native-control rule searches focusable, visible renderer controls. It lets those controls handle Enter, Space, arrows, Home and End. Tab stays native while another control is available inside the cell; AG Grid handles cell-to-cell navigation at the boundaries. These helpers observe no grid events and require no teardown.

## 6. Presentation signals and grid data updates

A CellRule callback can read application signals synchronously. Those reads participate in the renderer computed signal that evaluates the callback:

```ts
readonly currency = signal('USD');
readonly amountParams = {
  content: {
    number: { decimals: 2, unit: () => this.currency() },
  },
} satisfies NumberCellParams<Row>;
```

Changing currency invalidates dependent content calculations. Column/config/context objects can remain stable; no grid refresh is needed solely for that Angular display change. Independent categories remain cached. Conditional rules track only signals actually read. Empty numeric content does not subscribe to its skipped unit rule. Newly created virtualized renderers read current settings.

The example displays a code suffix; it does not perform currency conversion. Rules must stay synchronous and side-effect free. A static `unit: currency()` is a snapshot. Outside a reactive consumer the same calculation has no automatic update behavior.

This mechanism does not update AG Grid sorting, filtering, aggregation, export formatting or schema. Actual row/value changes still enter through AG Grid renderer params. The feature owns cache/model updates and explicit metadata refresh where value equality would otherwise leave markers/permissions stale.

## 7. Typed editors and presentation

[Editor contracts](../src/app/shared/grid-cells/editing/editor-host/editor-host.model.ts) separate an editor's data from its mounting location:

```ts
interface HostedEditor<D> {
  readonly data: InputSignal<D>;
}

interface EditorDefinition<D> {
  readonly component: Type<HostedEditor<D>>;
  readonly data: NoInfer<D>;
}

type EditorPresentation =
  | { readonly kind: 'popover'; readonly options?: PopoverOptions }
  | { readonly kind: 'dialog'; readonly options?: DialogOptions };
```

CellEditorConfig stores a component, a data factory taking CellContext and an optional presentation `{ kind, options }`. Options are an object or a factory taking CellOpenContext. Kinds come from the augmentable EditorPresentations interface, each served by a registered adapter. Editor opening constructs concrete data from the current cell; it is not automatically synchronized with later row/config changes.

EditorHostService is provided on the table/feature owner, not on virtualized cells. open(definition, presentation, { trigger }) returns an EditorRef or undefined if the owner is destroyed, its editor is already open, or the trigger is disconnected. Each service instance allows one active editor; different owners can open independently.

The host creates a child injector containing EditorRef and inherits feature providers. [bindEditorData](../src/app/shared/grid-cells/editing/editor-host/bind-editor-data.ts) checks Angular input metadata for a signal data input and sets its public input alias before initialization. Merely having a signal-valued property does not satisfy this runtime contract.

The host owns mounting cleanup and subscription resources for presentations. Signal-driven cell state does not eliminate overlay lifecycle subscriptions.

### 7.1 Popover

[PopoverService](../src/app/shared/popover/popover-service.ts) mounts a CDK connected overlay. Options include explicit element/point anchors, twelve placements, arrow, title, width/height/max sizes, backdrop, backdrop dismissal and scrollable.

The host defaults editor popovers to backdrop=true and closeOnBackdropClick=true. The standalone popover defaults backdrop=false. Both default to blocked background scrolling. scrollable=true opts into background scrolling/repositioning. Blocking includes nested background wheel/touch gestures while allowing overlay content scrolling.

Grid editor calls supply the trigger and no click point. The standalone popover request also supports click-point fallback. Element-anchor/trigger removal closes the popover. Resize/content-size/scroll changes update position and arrow geometry. Escape closes the active overlay regardless of backdrop-click policy.

### 7.2 Dialog

The host opens a Material MatDialog panel, then mounts the configured editor inside its portal outlet. DialogOptions support title, dimensions, maxima, backdrop and closeOnBackdropClick. The host caps dimensions to viewport margins and uses the shared background-blocking scroll strategy. DialogOptions has no scrollable field.

The host handles Escape and backdrop dismissal explicitly, disables Material's automatic close behavior and restores focus itself. A dialog has no anchor-removal observer, so it can outlive the original renderer trigger. Focus restoration prefers a connected trigger, then previous focus, then an owner-local focusable fallback. Owner destruction closes presentations without restoring focus into the destroyed owner.

### 7.3 Generic and complex editor forms

InputEditor supports typed string or number values, nullable initial/current values, label/placeholder, optional synchronous/async validators and a save(value):Promise<void> callback. Number mode adds a finite-number validator but permits null unless required validation is configured. TextareaEditor supports string values, label/placeholder, rows, optional validators/async validators and maxLength.

Generic editors use Angular Reactive Forms and Material form fields/buttons. They initialize from opening data in ngOnInit, prevent repeated submissions, keep fields read-only while saving, display validation errors separately from save errors, await save and close on success. Failure leaves the form open for retry. Save does not require dirty=true; dirty state is not a required HostedEditor contract.

A complex editor defines its own data/form/actions. The demo DetailsEditor has name, amount, notes and opening revision, and chooses Save details or Save and approve. Its feature actions can use different endpoints. There is no common host Save footer or host-owned payload construction.

## 8. Runtime flows

### 8.1 Render and refresh

```text
AG Grid agInit/refresh
  -> BaseCell shallow-copies params into a signal
  -> independent renderer computations evaluate category rules
  -> capability directives apply state to native elements
  -> Angular updates the existing renderer template
```

Application presentation signals can enter directly at category-rule evaluation without another AG Grid lifecycle call.

### 8.2 Pen editor

```text
Native pen click
  -> CellEditAction guards and emits activation
  -> EditCell checks current action and params
  -> renderer evaluates editor data and presentation configuration
  -> context.editorHost.open mounts the editor
  -> editor initializes its draft and validators
  -> Save validates and calls its save callback/feature action
  -> feature commits data and refreshes the grid as needed
  -> save promise resolves
  -> editor calls EditorRef.close
```

Missing editorHost throws during activation. Mounting/config errors are not generic-editor save errors. Busy/disconnected/destroyed host opening returns undefined; pen renderers do not expose a separate opening error UI.

### 8.3 Toggle

The native switch stops propagation, checks permission/local saving state, calls toggle.save(nextBoolean, cell) and reports errors through the control title. It does not open an editor. Committed row updates determine the displayed checked value; the renderer does not optimistically write canonical data. A repeated click while saving is rejected locally.

### 8.4 Dropdown

The native label button checks current permission and opens DropdownOptionsEditor through the host. The editor receives the current value/options array, equality function and a bound save callback. Options use a Material single-selection list without the trailing selection indicator or Cancel button.

Choosing a different enabled option starts a save. The list restores its committed selection before emitting the intent, prevents repeat submissions, closes after save succeeds and displays a live error on failure. Selecting an unchanged non-nullish value does nothing. Null and undefined are currently treated as no selection, although the generic option type does not exclude them as option values. A nullish-valued option can be submitted but will not be matched as the committed selection; selecting it again can submit another save. Escape/backdrop dismissal closes the presentation. The renderer's aria-expanded derives from whether its EditorRef is still active.

An opened editor receives an options reference rather than a reactive options factory. Replacing the options array through a signal updates the resting cell but does not automatically replace already-open editor data. Application persistence must validate the selected intent against current business rules.

### 8.5 Dismissal and pending saves

EditorRef.close, Cancel, Escape and configured backdrop clicks discard an unsubmitted draft. The shared host does not ask for dirty-discard confirmation. With `closeOnBackdropClick: 'when-clean'`, a backdrop click is ignored while the editor's optional `dirty` signal is true. Closing a presentation does not cancel an already-started feature save. Feature lifetime/dataset-generation policy determines whether a later response can commit. Popover trigger removal closes the presentation; dialog trigger removal alone does not.

## 9. Persistence contract and feature implementation

The only shared intent model is [EditCommand](../src/app/shared/grid-cells/editing/edit-command.model.ts):

```ts
interface CellIdentity {
  readonly rowId: string;
  readonly columnId: string;
}

type HttpQueryValue = string | number | boolean;
type HttpQueryParams = Readonly<Record<string, HttpQueryValue | readonly HttpQueryValue[]>>;

interface EditCommand<T> {
  readonly cell: CellIdentity;
  readonly data: T;
  readonly queryParams?: HttpQueryParams;
}
```

There is no shared submit/save/apply service pipeline. A generic editor callback binds cell identity, typed data and optional query params to a named feature action. A complex editor builds its own command and calls its chosen action directly. Promise<void> means the feature commit has completed according to that feature's implementation.

The demo contains two feature implementations with named saveName/saveAmount/saveNotes/saveReview/saveUnit/saveDetails/approveDetails actions:

- DemoClientPersistence validates against current rows, performs local business normalization including dependent rows, commits through the configured transaction/mutation strategy and publishes completion feedback.
- DemoServerPersistence snapshots plain intents, serializes them through a feature FIFO queue, re-reads current rows when execution starts, authorizes and validates, selects PATCH fields/details or POST approve endpoints, serializes query arrays as repeated keys, validates unknown response data and commits authoritative replacement/upsert rows.

DemoTableState holds canonical rows and a dataset generation. Reset advances generation, closes its active editor and publishes replacement rows. Server work checks owner lifetime/generation before transport and after response. Feature destruction rejects waiting actions; transport cancellation is not a shared kit guarantee. Completion feedback remains outside the editor.

[DemoGridUpdates](../src/app/features/grid-demo/demo-grid-updates.ts) owns one connected client-side grid. Connection requires a stable getRowId and synchronizes initial rows. Transactions use replacement rows; mutation assigns into feature-owned copies. Commits expire value caches, update grouping/filtering/aggregation/sorting when needed, force-refresh affected rows across columns and verify expected grid identity. Failed client transaction/mutation commits attempt to restore the prior grid/data state before publishing new canonical rows. The separate replacement path sets grid rowData and then refreshes, without rollback. If refresh throws after replacement, canonical rows are not published and grid data can be ahead of feature state. This is an implementation risk, not an atomic replacement guarantee.

These are demo policies, not mandatory queue/response contracts for all applications.

## 10. Integration and usage

### 10.1 Display-only column

```ts
readonly showUnits = signal(true);
readonly amountParams = {
  content: {
    alignment: 'end',

    number: {
      decimals: 2,
      unit: ({ data }) => (this.showUnits() ? (data?.unit ?? null) : null),
    },
  },
} satisfies NumberCellParams<Row>;

readonly columns = withCellKeyboardColumns<Row>([
  {
    colId: 'amount',
    field: 'amount',
    cellClass: 'grid-kit-cell',
    cellRendererSelector: () => ({ component: NumberCell, params: this.amountParams }),
  },
]);
```

Row must provide amount:number|null and unit:string for this example. Register the application's AG Grid modules/license, import the shared layout CSS and supply stable row IDs. Display-only cells need no EditorHostService provider.

### 10.2 Editable amount column

The owning table provides EditorHostService plus its own persistence/state providers. The following is the column portion of that table; persistence.saveAmount is an application action accepting EditCommand<{ value:number|null }>.

```ts
private readonly host = inject(EditorHostService);
readonly context = { editorHost: this.host } satisfies GridContext;

readonly amountParams = {
  action: {
    tooltip: 'Edit amount',
    permission: ({ data }) =>
      data?.reviewed
        ? { allowed: true }
        : { allowed: false, reason: 'Review this row before editing.' },

    editor: {
      component: InputEditor<number>,
      data: (cell) => {
        if (!cell.rowId || !cell.columnId) throw new Error('Missing cell identity.');
        const identity = { rowId: cell.rowId, columnId: cell.columnId };
        return {
          initialValue: cell.value ?? null,
          config: { label: 'Amount', mode: 'number', validators: [Validators.min(0)] },
          save: (value) =>
            this.persistence.saveAmount({
              cell: identity,
              data: { value },
              queryParams: { source: 'amount-editor' },
            }),
        };
      },
      presentation: {
        kind: 'popover',
        options: ({ trigger }) => ({
          anchor: { kind: 'element', element: trigger },
          placement: 'bottom',
          width: 320,
          title: 'Edit amount',
        }),
      },
    },
  },
  content: {
    number: { decimals: 2, unit: 'kg' },
  },
} satisfies EditCellParams<Row, number, InputEditorData<number>>;
```

For this example Row has reviewed:boolean. The owner must define the persistence dependency; the shared host does not provide it. Bind EditCell with these params, configure grid-kit-cell and use keyboard-composed definitions. A dialog uses `presentation: { kind: 'dialog', options }` instead.

The executable [AmountTableExample](../type-tests/docs/amount-table-example/amount-table-example.ts) provides the complete provider/template/action wiring. [SignalPresentationExample](../type-tests/docs/signal-presentation-example.ts) demonstrates stable columns and signal-reading rules.

### 10.3 Select one synchronization path

A rowData-bound table binds canonical rows and can use one explicit rowDataUpdated handler to force-refresh rendered rows when unchanged values have new metadata:

```ts
onRowsUpdated(event: RowDataUpdatedEvent<Row>): void {
  event.api.refreshCells({ rowNodes: event.api.getRenderedNodes(), force: true });
}
```

A connected table calls feature state.connectGrid(api) in gridReady, and feature commits own later updates. It must not also bind rowData for the same commits. [ClientTableExample](../type-tests/docs/client-editing-example.ts) demonstrates this path. Table replacement/removal must disconnect the corresponding API or destroy the owning feature.

Reactive definitions are appropriate when schema changes; stable signal-reading rules are appropriate for display changes. Backend column-layout restoration and export projections are application concerns and have no implementation in this kit.

## 11. Extension rules

A new cell renderer extends BaseCell with a renderer-specific intersection of category types, declares the required independent computed state and uses capability directives on native elements. It adds activation only for capabilities it implements. Composite content can use a small container where its native controls require one.

A new hosted editor declares an Angular signal data input, implements HostedEditor<D>, injects EditorRef and owns its actions. The data can contain save callbacks or feature identity/configuration; feature services remain available through the inherited injector. The host does not require dirty state or a fixed form shape.

Application signals can be shared across tables, but each editing table normally provides its own host and context. The shared library does not require NgRx.

## 12. Performance and verification

Resting renderers create native marker/content/action elements only as configured. Marker/pen visuals use pseudo-elements; capability directives add no wrappers. Forms, Material option lists and overlay panels mount only when activated. BaseCell retains renderer instances on refresh. Independent computed categories cache their results. Signal-driven display updates avoid grid refreshes solely for the settings change. These are structural properties, not a measured guarantee for a particular large-table workload.

The current demo renders twelve rows and ten columns with text/number popovers, notes/details dialogs, native toggle/dropdown and composite content. It is not a large-table benchmark.

Verification commands are defined in package.json:

```sh
npm run build
npm run test:types
npm run test:unit
npm run test:e2e
```

Evidence locations:

| Behavior                                                                     | Executable evidence                                                 |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Lifecycle/category defaults and marker priority                              | core and capabilities unit suites                                   |
| Signal dependency tracking, stable elements, owner isolation and destruction | renderers/signal-presentation.spec.ts                               |
| Keyboard composition/default inheritance and repeat application              | integration/cell-keyboard.spec.ts                                   |
| Typed opening/mounting/focus/cleanup                                         | grid-cells/editing/editor-host/editor-host-service.spec.ts          |
| Field validation, nullable numbers and error/retry                           | editing/editors/field-editors.spec.ts                               |
| Current-row authorization, FIFO, generations and commit rollback             | demo-client-persistence.spec.ts and demo-server-persistence.spec.ts |
| Presentation changes without refresh/column rebuild, new virtualized cells   | e2e/signal-presentation.spec.ts                                     |
| Save/dismissal/direct controls and overlay accessibility                     | e2e field/material/server/direct-control/popover suites             |
| Public type compatibility and documentation templates                        | type-tests and type-tests/docs                                      |

Automated browser accessibility checks cover the tested presentations and viewport scenarios; they are not a claim that every application configuration satisfies all accessibility requirements. Native tooltips, narrow widths, external row models, shared settings lifetimes and application save authorization remain integration review points.

## 13. Independent architecture review

Reviewed by GPT-6 Astra on 2026-10-06. The review below was made against the first draft and current implementation. The two documentation qualifications have been incorporated into sections 8.4 and 9. The implementation concerns remain open; no source code was changed by this specification or review task.

### 13.1 Review basis

Reviewed the specification against current implementation, using the [codebase-design skill](/Users/beekeeper/.codex/skills/codebase-design/SKILL.md) and the [architect design-red-flags checklist](../.agent/skills/architect/references/design-red-flags.md). Prior discussions and other design or migration documents were not used as authority. The architect's how, why and arena helpers were unavailable, so this review used direct source tracing.

The main ownership model matches the code. Renderers calculate presentation and initiate actions; the host mounts editors; editors own drafts and save interaction; feature persistence authorizes and commits changes. The host is a deep module because its small opening interface hides substantial mounting, dismissal and cleanup behavior.

Two documentation qualifications and three implementation concerns follow. P2 means a correctness issue in a supported configuration or failure path. P3 means a maintenance concern without a reproduced user-facing failure.

### 13.2 Specification qualifications, incorporated

1. **P2. Section 9 overstated rollback coverage.** The original statement that failed commits restore prior grid/data state applies to the guarded client commit path, not every update path. [DemoGridUpdates.replace](../src/app/features/grid-demo/demo-grid-updates.ts#L36) sets grid data and then refreshes cells without a catch or rollback. [DemoTableState.publishRows](../src/app/features/grid-demo/demo-table-state.ts#L41) publishes canonical rows only after that operation returns. Both replacement and upsert server responses use this path. The documented guarantee is now narrowed to client transaction/mutation commits, with replacement failure behavior described explicitly.
2. **P2. Section 8.4's unchanged-selection guarantee excluded nullish values.** [DropdownOptionsEditor.choose](../src/app/shared/grid-cells/renderers/dropdown-options-editor.ts#L43) performs the unchanged check only when the initial value is neither null nor undefined. The generic option contract does not exclude those values. The specification now describes null and undefined as no selection and qualifies the unchanged-selection behavior.

### 13.3 Architectural and implementation concerns

1. **P2. Server replacement can leave grid data ahead of canonical state after a refresh failure.** In [DemoGridUpdates.replace](../src/app/features/grid-demo/demo-grid-updates.ts#L42), setGridOption('rowData', ...) precedes refreshCells. If the latter throws, the grid already has replacement rows, but [publishRows](../src/app/features/grid-demo/demo-table-state.ts#L41) never updates rowsSource. Subsequent authorization reads old canonical rows while the grid holds replacement data. This is a concrete failure path, not a claim that ordinary refreshes fail. Give replacement operations an explicit atomicity or recovery policy, and cover a failure after grid replacement with an existing persistence test. The client path provides a local precedent at [commit's catch block](../src/app/features/grid-demo/demo-grid-updates.ts#L95).
2. **P2. Dropdown types and selection semantics disagree about nullish option values.** [DropdownOption](../src/app/shared/grid-cells/capabilities/dropdown.ts#L6) permits DropdownOption<string | null>. However, [computeDropdown](../src/app/shared/grid-cells/capabilities/dropdown.ts#L19) skips matching a nullish current value, and [DropdownOptions.selectedIndex](../src/app/shared/grid-cells/renderers/dropdown-options.ts#L56) treats it as absent. An enabled { value: null, label: 'None' } option can be submitted, but its committed label will not appear. Selecting it again can submit another save because both unchanged-value guards bypass nullish values. Choose one contract: either reserve nullish values for absence and reject them as option values, or represent absence separately and compare valid nullish options normally. Apply that decision consistently to display, selected state and repeat-save prevention.
3. **P3. Hosted popovers have two focus-restoration owners.** [PopoverService](../src/app/shared/popover/popover-service.ts#L76) restores focus synchronously during ordinary closure. [EditorHostService.dismiss](../src/app/shared/grid-cells/editing/editor-host/editor-host-service.ts#L127) also schedules restoration through [restoreFocus](../src/app/shared/grid-cells/editing/editor-host/editor-host-service.ts#L141). The host adds owner-lifetime and active-editor checks that the standalone popover path does not share. Normal closure can run two restoration policies, and future changes must account for both implementations. This is split ownership; this review did not reproduce a focus failure. Prefer one restoration owner for hosted presentations, while retaining standalone popover restoration as its own supported behavior.

### 13.4 Areas consistent with the implementation

- **Signals and lifecycle.** BaseCell shallow-copies params on initialization and refresh. Separate renderer computations permit category-specific application-signal dependencies. Numeric content skips its unit rule for invalid or empty values. The document correctly distinguishes these Angular updates from grid sorting, filtering and export behavior.
- **Keyboard configuration.** Recursive leaf composition, inherited default callbacks, explicit overrides and idempotent application match the helper. Application callbacks run before their result is combined with native-control suppression.
- **Editor mounting and save races.** The host binds the Angular signal input before initial editor rendering and handles closure during mounting. Editor references close their own captured editor, so an old save's eventual close does not directly close a newly opened editor. Dismissal does not cancel feature saves, as documented.
- **Persistence responsibilities.** Current-row authorization, server queueing, dataset-generation checks and feature-owned completion feedback are implemented in the demo. They are correctly described as demo policy rather than shared-kit guarantees.
- **Usage and performance.** The amount example supplies the provider, context, renderer, action and row-refresh wiring described by the document. The distinction between row-data binding and connected-grid ownership is useful. Performance claims are limited to structural properties rather than benchmark results.

### 13.5 Inspection and verification limits

Inspected the specification, package scripts, public entry point, core lifecycle/context behavior, keyboard helpers, action and number calculations, dropdown contracts and selection flow, toggle and pen renderers, generic field editors, editor-host mounting and cleanup, popover lifecycle, Escape handling, demo client/server persistence, table state, grid update implementation and the executable amount-table example. Existing signal, keyboard, direct-control, host and persistence test coverage was consulted selectively.

No tests, build, browser interaction or accessibility audit were executed for this review. The identified failure paths are source-based findings. No source files were changed. Document formatting and source-link existence were checked separately after the review was incorporated.
