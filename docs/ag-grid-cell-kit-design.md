# Cell kit design

The cell kit provides composable Angular renderers for AG Grid. A renderer computes its display from cell params and opens an editor when activated. Editor presentation and feature persistence have separate responsibilities.

The repository uses Angular 21, Angular Material/CDK 21 and AG Grid Enterprise 36.2.0. Components use OnPush, signal inputs, Reactive Forms and independent computed state. The kit is application source, not a published package.

[Usage](cell-kit-usage.md) covers setup and examples. [Flows](cell-kit-flows.md) identifies the implementation files used while opening, saving and closing.

## Ownership

| Module                 | Responsibility                                                                                                | Lifetime                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Renderer               | Read current params, compute categories, check activation permission, construct opening data                  | Virtualized cell                  |
| Capability calculation | Convert the relevant params into one display state                                                            | Pure function call                |
| Capability directive   | Apply classes, styles, tooltip and accessibility attributes to an existing element                            | Renderer element                  |
| EditorHostService      | Mount typed editor data, choose presentation, dismiss, restore focus and clean up                             | Owning table or feature component |
| Editor                 | Draft, validation, pending/error UI, choice of business action                                                | Open presentation                 |
| Feature persistence    | Authorize against current data, build payload, call HTTP or calculate local rows, commit and publish feedback | Owning feature                    |
| Feature table state    | Canonical row set, dataset generation and one grid synchronization path                                       | Owning feature                    |
| Keyboard helpers       | Compose application and native-control keyboard callbacks during column configuration                         | Column definitions                |

A hosted editor inherits its owner's injector. Provide EditorHostService on the owning table component so a virtualized renderer does not own the edit lifetime. Persistence may continue after the editor closes; feature destruction and dataset resets control whether its result can commit.

## Folder structure

```text
src/app/shared/
  grid-cells/
    public-api.ts
    core/
      base-cell.ts
      cell-context.model.ts       CellContext, CellOpenContext, CellRule
      cell-context.ts             CellFacts, toCellContext
      grid-context.model.ts       optional editorHost
      renderer-params.model.ts
      evaluate-cell-rule.ts
      suppress-cell-control-keyboard.ts
    capabilities/
      content/                    config/state, computeContent, computeTextContent, CellContent
      marker/                     priority rules, computeMarker, CellMarker
      action/                     permissions, computeAction, CellEditAction
      number/                     formatting, units, computeNumberContent
      toggle/                     save callback, computeToggle
      dropdown/                   options, save callback, computeDropdown
    renderers/
      text/                       TextCell, TextCellParams
      number/                     NumberCell, NumberCellParams
      popover/                    PopoverCell, PopoverCellParams
      dialog/                     DialogCell, DialogCellParams
      toggle/                     ToggleCell, ToggleCellParams
      dropdown/                   DropdownCell, on-demand Material options editor
    editing/
      edit-command.model.ts       EditCommand<T>, CellIdentity, HTTP query types
      editor-host/
        public-api.ts
        editor-host.model.ts           HostedEditor, EditorDefinition, EditorPresentation
        editor-host-service.ts
        editor-ref.ts
        bind-editor-data.ts            private signal input binding
        dialog-options.model.ts
        dialog-editor-panel/           private Material dialog mounting panel
      editors/
        value-editor.model.ts     typed data factory and save callbacks
        editor-presentation.model.ts  popover/dialog editor config
        field-editor-config.model.ts
        input/                    InputEditor and its data/config
        textarea/                 TextareaEditor and its data/config
    integration/
      cell-keyboard.ts            withCellKeyboard, withCellKeyboardColumns
    styles/cell-layout.scss
  popover/
    public-api.ts                  app popover, independent of the grid
    popover-service.ts
    popover.model.ts               anchor, placement and scrolling options
    popover-open.model.ts
    popover-ref.ts
  overlay/                        shared scroll and Escape implementation

src/app/features/grid-demo/
  demo-columns.ts                 binds params and feature action callbacks
  demo-grid-context.model.ts       extends GridContext with application mode
  demo-persistence.model.ts        feature actions, token and feedback
  demo-editing-providers.ts        client/server provider selection
  demo-server-persistence.ts       feature queue, HTTP and response commit
  demo-client-persistence.ts       local calculation and selected commit strategy
  demo-edit-intent.ts              private authorization and payload calculation
  demo-table-state.ts              canonical rows and reset/commit methods
  demo-grid-updates.ts             private transaction/mutation/replacement implementation
  api/                            feature wire types, parsing and mock HTTP behavior
  editors/                        complex feature editor and presentation demo editor
  cells/                          application-specific renderers and composite toggle/number
```

Import supported grid contracts through [public-api.ts](../src/app/shared/grid-cells/public-api.ts). The reusable host and app popover also have their own public entry points. Private mounting and geometry helpers are not consumer contracts.

## Cell context and rules

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

interface GridContext {
  readonly editorHost?: EditorHostService;
}

type RendererParams<R, V, C> = ICellRendererParams<R, V, GridContext> & C;
```

CellContext is the row identity, column identity, row data and value available to a calculation or data factory. Missing row data and identity are valid for display, such as group rows, but cannot authorize editing. `toCellContext` extracts this small shape from runtime params. `CellFacts` is the subset of grid params required by pure calculations, so those calculations need no GridApi.

CellRule lets a config accept a constant or a row-dependent function. A permission can be constant, while a marker or tooltip can depend on metadata. `evaluateCellRule` calls a function or returns the constant. Rules should be pure and cheap. In particular, user-edited marker logic belongs to the application. The demo caches a placeholder predicate so refreshes do not randomly change a cell's marker.

CellOpenContext adds the current activation element for popover configuration. Grid editors anchor to that element by default. Point anchoring and click-point fallback belong to the general app popover.

GridContext is table-level context. Applications extend it with their own typed fields. A display-only table needs no editorHost or persistence providers.

## Composable params and state

Each category has its own config, state and calculation. Renderer params compose only the categories that renderer supports.

| Renderer         | Params categories                                                   | Editor behavior                                         |
| ---------------- | ------------------------------------------------------------------- | ------------------------------------------------------- |
| TextCell         | ContentPart, MarkerPart                                             | Display only                                            |
| NumberCell       | ContentPart, MarkerPart                                             | Display only                                            |
| PopoverCell      | ContentPart, MarkerPart, ActionPart with popover editor             | Pen opens custom popover                                |
| DialogCell       | ContentPart, MarkerPart, ActionPart with dialog editor              | Pen opens Material dialog                               |
| ToggleCell       | ContentPart, MarkerPart, ActionPart, TogglePart                     | Native switch calls configured save                     |
| DropdownCell     | ContentPart, MarkerPart, ActionPart, dropdown                       | Native trigger opens Material options in custom popover |
| ToggleNumberCell | ContentPart, MarkerPart, ActionPart with popover editor, TogglePart | Independent switch and number pen                       |

```ts
interface ContentPart<R, V> {
  content?: ContentConfig<R, V>;
}
interface MarkerPart<R, V> {
  markers?: Partial<Record<MarkerKind, MarkerRule<R, V>>>;
}
interface ContentConfig<R, V> {
  number?: [NonNullable<V>] extends [number] ? NumberConfig<R, V> : never;
  text?: CellRule<R, V, string>;
  // Other content fields include alignment, tooltip and appearance.
}
interface TogglePart<R, V = boolean> {
  readonly toggle: ToggleConfig<R, V>;
}

type NumberCellParams<R> = ContentPart<R, number> & MarkerPart<R, number>;
```

ActionPart configures pen presence, permission, tooltip and a typed editor under action.editor for pen renderers. An absent action renders content without a pen; a configured edit action requires its editor. Toggle and dropdown have their own required save callbacks and optional permission. A control's permission takes precedence over action.permission. Content disabled styling does not grant or deny edit permission.

BaseCell owns the shared AG Grid lifecycle. `agInit` and `refresh` shallow-copy the incoming params into a signal. `refresh` returns true, allowing Angular to update the existing renderer DOM. The copy invalidates consumers even when AG Grid supplies the same params reference. It preserves row and GridApi references.

Renderers keep category state separate:

```ts
readonly cellContent = computed(() => computeTextContent(this.params()));
readonly cellMarker = computed(() => computeMarker(this.params()));
readonly cellAction = computed(() => computeAction(this.params()));
```

Add a new renderer by choosing param parts, pure calculations and directives for its existing elements. Use a dedicated template for a composite control. Do not nest complete renderer components or add a universal renderer with a branch for every content type.

## Display and layout

Content supports alignment, highlighted and muted styling, tooltip and ellipsis. Ellipsis defaults to true. A content tooltip is optional and is independent from marker and action tooltips. Text display uses a formatted grid value when available; text and numeric renderers can supply a `content.text` rule.

NumberCell formats finite numbers with locale, fixed decimals and optional grouping. Grouping defaults to true. The shared formatter cache has a limit of 128 entries. Units appear only for a present finite numeric value, including zero. Null, undefined and non-finite values render empty and omit the unit.

Only the highest matching marker renders, in this order:

1. Error.
2. Warning.
3. Blue user-edited dot.
4. Purple system-generated dot.
5. Info.
6. Black special-case square.

Each marker has its own optional tooltip rule. Marker icons use CSS pseudo-elements and accessible labels. Tooltips use native title attributes.

Apply `grid-kit-cell` to ColDef.cellClass and load the global layout styles. The renderer reserves 24px on each side. The marker sits at left 4px and the pen at right 4px, both positioned absolutely. They do not reduce content width beyond the reserved padding. The pen appears on cell hover and on keyboard focus. A denied pen remains focusable with aria-disabled and its reason; activation guards prevent opening.

Content/marker/action directives bind to the elements already present in the template. Ordinary cells have a content span and at most one marker span. Editable cells add a native pen button only when action state makes it visible. Resting controls remain native; Material editor content mounts only when opened. Row and column virtualization stay enabled.

## Editor contracts

```ts
interface HostedEditor<D> {
  readonly data: InputSignal<D>;
}
interface EditorDefinition<D> {
  readonly component: Type<HostedEditor<D>>;
  readonly data: NoInfer<D>;
}
interface CellEditorConfig<R, V, D> {
  readonly component: Type<HostedEditor<D>>;
  readonly data: (cell: CellContext<R, V>) => NoInfer<D>;
}
interface PopoverEditorConfig<R, V, D> extends CellEditorConfig<R, V, D> {
  readonly popover?: PopoverOptions | ((cell: CellOpenContext<R, V>) => PopoverOptions);
}
interface DialogEditorConfig<R, V, D> extends CellEditorConfig<R, V, D> {
  readonly dialog?: DialogOptions;
}
interface ValueEditorData<V, C> {
  readonly initialValue: V;
  readonly config: C;
  readonly save: (value: V) => Promise<void>;
}
```

PopoverCellParams and ToggleNumberCellParams use PopoverEditorConfig under editor. DialogCellParams uses DialogEditorConfig. Presentation options belong to action.editor.popover or action.editor.dialog. Field config remains independent of presentation, so InputEditor and complex components can be hosted in either presentation.

`D` is the editor's opening data, not a mandatory session object. Generic field editors use ValueEditorData. InputEditorData<number> carries number-or-null values and number mode; InputEditorData<string> carries string-or-null values and text mode. TextareaEditorData carries a string, rows and optional maxLength. Field config requires a label and accepts optional synchronous and asynchronous validators.

Complex editors define their own `D`, Reactive Form and actions. They may include identity, initial draft, revision and query params. They inject feature persistence and EditorRef directly. They need no configured validator list or common action footer.

The same editor can use `{ kind: 'popover', options }` or `{ kind: 'dialog', options }`. The host binds the data signal before its first render and ngOnInit. It permits one editor per owner. Escape always closes; a backdrop closes on click by default. Popovers block background scrolling by default, with `scrollable: true` available. Dialogs block background scrolling. An element-anchored popover closes if its trigger or anchor disappears. A dialog can survive trigger removal.

Dismissal destroys the draft and presentation. A successful save closes through the editor's injected EditorRef. A rejected save retains the open draft and shows an error. Dismissal during an already submitted save does not cancel feature persistence. There is no shared discard-confirmation contract. See [editor host](editor-host.md) and [cell editors](cell-editors.md).

## Persistence and canonical state

```ts
interface EditCommand<T> {
  readonly cell: { readonly rowId: string; readonly columnId: string };
  readonly data: T;
  readonly queryParams?: Readonly<
    Record<string, string | number | boolean | readonly (string | number | boolean)[]>
  >;
}
```

The command carries typed business data and the originating cell. The feature action determines endpoint, payload, authorization and update semantics. Column ID need not be a backend field name. Generic editor save callbacks bind identity/query parameters directly to an explicit feature method. Complex editors can choose different actions and endpoints themselves.

| Strategy           | State and grid commit                                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Server replacement | Validate returned complete rows, publish canonical rows, replace grid rowData through the chosen synchronization path       |
| Client transaction | Calculate complete affected rows, apply one update transaction, verify the result, publish canonical replacement references |
| Client mutation    | Change feature-owned current rows, refresh the grid model and affected cells, publish a new canonical array                 |

Use one synchronization path. The demo connects its grid to feature state and does not bind rowData. A simple server-only application can bind rowData to canonical rows instead. Do not combine the binding with transactions for the same commit. Immutable application state and NgRx require replacement rows; mutation is only for owned mutable rows.

Server actions that can replace the same dataset share a feature FIFO queue. They re-read current rows, authorize, validate revisions and reject obsolete generations before committing. A full response can delete the edited row or return no rows. Reset increments generation and closes the active editor. Feedback remains in the feature after dismissal. These policies belong to feature persistence, not the shared host. See [feature persistence](feature-persistence.md).

## Grid integration and reactive presentation

Bind stable editor-host context directly to AG Grid and configure column keyboard behavior with withCellKeyboardColumns. When application keyboard behavior lives in defaultColDef, pass those defaults to the column helper so unconfigured columns inherit that callback. withCellKeyboard supports default-only configuration. The helpers preserve application callbacks and do not observe grid events.

A CellRule callback may read application signals. Because renderers call compute functions inside independent Angular computed signals, those reads become category dependencies. For example, a unit rule reading currency updates content when currency changes while unrelated markers remain cached. Column definitions and renderer instances remain stable. Rules are synchronous calculations and perform no side effects.

Grid row updates still pass through BaseCell.agInit/refresh. Feature persistence owns the connected grid's cache/model updates and affected-row refresh. A rowData-bound table explicitly refreshes accepted visible metadata when normal value comparison is insufficient. Presentation signals do not change grid sorting, filtering, aggregation or exports.

Reactive column definitions are appropriate for schema changes. Backend layout preferences are column state with stable IDs, and can be restored independently of schema and context. Shared application settings signals do not require shared editor hosts.

A focus trap confines focus to an open presentation. Background scroll blocking is a separate popover/dialog setting. Neither requires a grid-specific interaction lock. Excel editing, clipboard workflows and native AG Grid cell editors are outside this kit's scope.

[Grid integration](cell-kit-integration.md) documents the setup and update ownership. Dated DOM and timing evidence remains in [historical measurements](measurements.md).
