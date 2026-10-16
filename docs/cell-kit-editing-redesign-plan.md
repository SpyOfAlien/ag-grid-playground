# Cell kit editing redesign implementation plan

This is a historical plan. The current API nests numeric formatting in `content.number` and hosted editor configuration in `action.editor`. See [cell kit usage](cell-kit-usage.md) for current examples.


Integration update: the runtime CellKit directive described in this historical plan is superseded by [signal-driven presentation and declarative keyboard configuration](cell-kit-signal-driven-plan.md). Current setup is documented in [grid integration](cell-kit-integration.md).

Status: phases 1–7 complete. Phase 8 remains pending. Production code, public contracts, consumer examples and general documentation describe the editor host and feature-action design.

Editor configuration work follows [the editor configuration plan](cell-kit-editor-config-plan.md) first. Resume final verification after that change, including the new factory and nested presentation contracts.

## Objective

Make editing traceable through two meaningful modules: reusable editor presentation and feature persistence. Preserve composable cell capabilities and renderer-specific configuration. Retain a typed edit-command envelope without a generic command-processing pipeline.

The current application uses Angular 21, Angular Material/CDK 21, and AG Grid 36.2. Keep the installed versions during this migration. Follow AGENTS.md, use Reactive Forms, and preserve existing uncommitted changes.

## Target flow and ownership

```text
Cell activation -> EditorHostService.open -> custom PopoverService or MatDialog
                -> editor receives its typed data
Editor Save -> feature persistence action(EditCommand<T>)
            -> authorize and build payload, or calculate local change
            -> commit application state and synchronize grid
            -> promise resolves -> editor closes
```

Inline toggle: control -> configured save(value) -> feature persistence action -> commit.
Dropdown: cell -> editor presentation -> Material option list -> configured save(value) -> commit -> close.
Complex editor: its action -> feature persistence.saveDetails/approveDetails(command) -> commit -> close when appropriate.

| Module                          | Owns                                                                                                                                                  |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Renderer                        | Display categories, action permission, activation, constructing editor data from current cell params                                                  |
| Editor presentation             | Dynamic data binding, feature injector/lifetime, popover/dialog adapter, focus, dismissal, cleanup                                                    |
| Editor                          | Draft, field/form validation, action selection, local pending/error state, calls to configured save or feature persistence                            |
| Feature persistence             | Current-row authorization, payload/query construction, HTTP or client update, sequencing, stale-response checks, durable error feedback, state commit |
| Feature table state/integration | Canonical rows, stable IDs, dataset generation, selected grid synchronization path                                                                    |
| Optional cell integration       | Keyboard composition and targeted display refresh; no persistence protocol                                                                            |

Saving fulfills after canonical state and the selected grid update have been applied or published through the configured row-data binding. Angular view rendering follows its normal render cycle. A rejected save leaves an open editor available for retry. Closing a popup does not cancel an already submitted mutation.

## Behavior to preserve

- Keep BaseCell, CellContext, GridContext, CellRule and independently computed capability signals. Do not introduce a giant params model or extra component inheritance.
- agInit and refresh update the renderer params signal; refresh returns true for compatible renderer instances. Allow AG Grid to replace a renderer when cellRendererSelector selects a different type.
- Keep renderer-specific params, cellRendererSelector, composite toggle/number rendering, and optional future column builders.
- Keep content, marker, and action order. Markers and hovered pens remain absolute, 4px from the border, with 24px padding on both sides.
- Preserve one marker in priority order: Error, Warning, user-edited blue dot, generated purple dot, Info, special-case black square. Preserve per-marker/tooltips and application-defined edited logic.
- Preserve alignment, highlighted/disabled content, existing ellipsis defaults and overrides, value tooltips, decimal/group formatting, and units only for present values, including zero.
- Preserve editable-column rules, per-cell disabled reasons, native resting controls, Material editors and selected dropdown styling. Dropdowns have no radio indicator or Cancel button; outside click discards an unsubmitted selection.
- Keep custom app popovers and MatDialog. Preserve dimensions, placement, arrow, explicit element/point anchors, configurable backdrops, outside-click dismissal, Cancel where the editor provides it, and unconditional Escape dismissal.
- Grid editors anchor to the activating pen/control by default. Keep point anchoring in the generic app popover, without requiring clickPoint in grid opening data.
- App popovers default to scrollable=false; grid popovers use that default. Keep configurable background scrolling, overlay-internal scrolling, shared Escape behavior, focus trapping and restoration. Do not restore lockGridInteraction.
- Popovers close on anchor loss. Dialogs can survive trigger removal. Both close on feature destruction. A late close from an old popup must not close a newer popup.
- Keep one active editor per feature/table owner through the presentation module, without row lookup, table reconciliation, or a second editor store.
- Keep client/server modes, complex actions with distinct endpoints, optional synchronous/asynchronous generic field validators, and complex-editor-owned validation.
- Support authoritative server dataset replacement, including dependent rows and removal of the edited row. Partial upsert semantics remain feature response logic where needed.
- Scope client mutation/transaction examples to the Client-Side Row Model. Do not claim support for other row models.
- Excel behavior, installing NgRx, and the future column-definition builder are outside this migration. Dirty-discard confirmation remains an optional follow-up; current dismissal discards unsubmitted drafts.

## Target types

These are target contracts, not the currently published interface. Keep executable acceptance examples isolated until migration finishes.

### Typed command envelope

```ts
export interface CellIdentity {
  readonly rowId: string;
  readonly columnId: string;
}

export type HttpQueryValue = string | number | boolean;
export type HttpQueryParams = Readonly<Record<string, HttpQueryValue | readonly HttpQueryValue[]>>;

export interface EditCommand<T> {
  readonly cell: CellIdentity;
  readonly data: T;
  readonly queryParams?: HttpQueryParams;
}
```

The column identifies the origin, not an automatic backend property. T is the action's edit intent, not necessarily Partial<Row> or an HTTP payload. Commands carry no operation, execution callback, update instructions, or mandatory result protocol. Readonly is shallow; persistence protects queued commands from later caller mutation using feature-specific draft snapshots.

### Reusable presentation

```ts
export interface HostedEditor<D> {
  readonly data: InputSignal<D>;
}

export interface EditorDefinition<D> {
  readonly component: Type<HostedEditor<D>>;
  readonly data: NoInfer<D>;
}

export abstract class EditorRef {
  abstract close(): void;
}

export interface EditorOpenContext {
  readonly trigger: HTMLElement;
}

export type EditorPresentation =
  | { readonly kind: 'popover'; readonly options?: PopoverOptions }
  | { readonly kind: 'dialog'; readonly options?: DialogOptions };

export declare class EditorHostService {
  open<D>(
    editor: EditorDefinition<D>,
    presentation: EditorPresentation,
    context: EditorOpenContext,
  ): EditorRef | undefined;
  close(): void;
}

export interface GridContext {
  readonly editorHost?: EditorHostService;
}
```

Provide EditorHostService at the table component together with feature persistence. It injects Injector and DestroyRef once in that scope, captures its provider context, and disposes its active popup when the feature is destroyed. Neither dependency is passed on individual open calls. Do not provide this service at root or on virtualized renderers. Renderers receive the table-scoped instance through typed grid context.

EditorHostService.open accepts the editor definition, presentation and activation trigger, and returns a reference. It returns undefined when another popup is already open or the service/trigger is unavailable. close() dismisses the current popup and supports feature reset cleanup. Invalid editor input wiring is a configuration error and must clean up before throwing. Editors inject the same reference to close. Keep adapter-specific native references private. Reuse the current narrow DialogOptions instead of exposing all MatDialogConfig. Resolve default/explicit popover options once at activation. Bind required data before rendering. Keep any necessary dynamic input metadata handling private, using unknown and a narrow runtime check rather than any or unchecked public casts.

### Editor and renderer-specific configuration

```ts
export type SaveValue<V> = (value: V) => Promise<void>;

export interface ValueEditorData<V, C> {
  readonly initialValue: V;
  readonly config: C;
  readonly save: SaveValue<V>;
}

export interface CellEditorConfig<R, V, D> {
  readonly component: Type<HostedEditor<D>>;
  readonly data: (cell: CellContext<R, V>) => NoInfer<D>;
}

export interface PopoverEditParams<R, V, D> {
  readonly editor: CellEditorConfig<R, V, D>;
  readonly popover?: PopoverOptions | ((open: CellOpenContext<R, V>) => PopoverOptions);
}

export interface DialogEditParams<R, V, D> {
  readonly editor: CellEditorConfig<R, V, D>;
  readonly dialog?: DialogOptions;
}
```

Compose these with ContentPart, MarkerPart and ActionPart in only the appropriate renderer params. Preserve the actual CellContext names: rowId, columnId, data and value. Do not use an invented cell.row property in examples. Missing data/identity on group or placeholder rows prevents editing. Grid CellOpenContext keeps trigger but loses its grid-specific clickPoint.

InputEditorConfig and TextareaEditorConfig become field-only configuration. Retain input mode, placeholder, validators and asyncValidators; add label and retain other supported field options. Enforce text/number mode and nullable value compatibility in type fixtures. Remove row generics, change, toChanges and operation from field config. Complex editors own their typed opening data and forms without implementing ValueEditorData or a common action-list model.

### Feature actions

```ts
export interface AmountEdit {
  readonly value: number | null;
}

export interface DetailsEdit {
  readonly description: string;
  readonly enabled: boolean;
  readonly revision: string;
}

export interface TablePersistence {
  saveAmount(command: EditCommand<AmountEdit>): Promise<void>;
  saveDetails(command: EditCommand<DetailsEdit>): Promise<void>;
  approveDetails(command: EditCommand<{ readonly revision: string }>): Promise<void>;
}
```

The feature owns this interface and its injection token or abstract class. Provide real client and server implementations at feature scope. Avoid a shared generic persistence interface or a facade that only forwards through another facade. The demo can select implementations directly when changing its mode. Generic editor save closures and direct controls bind typed actions; complex editors inject the same feature persistence contract.

## Target folder structure

```text
src/app/shared/
  popover/                         # existing app popover, anchors and scroll options
  overlay/                         # shared Escape and background scrolling
  grid-cells/
    core/                          # base-cell, cell-context, grid-context, CellRule
    capabilities/                  # independent content/marker/action/number/toggle/dropdown
    renderers/                     # text, number, popover, dialog, toggle, dropdown
    editing/
      edit-command.model.ts        # identity, typed data and optional queries only
      editor-host/
        editor-host.model.ts          # HostedEditor, EditorDefinition, opening context
        editor-ref.ts            # injectable close reference
        editor-host-service.ts        # one presentation entry point
        bind-editor-data.ts            # private dynamic-input binding
        dialog-options.model.ts
        dialog-editor-panel/           # Material dialog mounting and layout
      editors/
        value-editor.model.ts
    field-editor-config.model.ts
        input/
        textarea/
    integration/
      cell-kit.ts                  # optional display/context/keyboard integration
      cell-kit-keyboard.ts
    public-api.ts
src/app/features/grid-demo/
  demo-table-state.ts               # canonical rows and dataset generation
  demo-persistence.model.ts         # domain intents and feature contract/token
  demo-editing-providers.ts         # feature-scoped state/host/persistence providers
  demo-client-persistence.ts        # local calculations and commit
  demo-server-persistence.ts        # HTTP payloads and authoritative commit
  demo-grid-updates.ts              # feature-local grid synchronization, only if needed
  demo-columns.ts                  # binds current cell identity to typed actions
  demo-grid-context.model.ts        # table-scoped editorHost and application context
  api/                             # feature endpoint and response models
  editors/                         # details and other feature editors
    details-editor-data.model.ts
    details-editor.ts
  cells/toggle-number/             # composite capability example
```

Private files are implementation choices, not additional required consumer setup. A small named method can replace a file when it keeps behavior readable. Do not build an injectable forwarding module for each internal step.

## State ownership and lifetime acceptance rules

| Situation                     | Required behavior                                                                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Mutable client rows           | Feature state owns mutable row references, explicitly notifies state consumers after mutation, and refreshes the grid. Direct mutation never targets NgRx state.                     |
| Immutable transaction updates | Feature state owns replacement rows. A single commit path updates canonical state and issues one transaction; a second reactive rowData replacement must not also run for that edit. |
| Authoritative server response | Feature state accepts the complete response dataset, including deletion, and drives one full grid synchronization. Backend rows are not inferred from the originating column.        |
| Unrelated reset/reload        | Advance dataset generation and close the table's active popup or invalidate its bound action. Old drafts cannot target a replacement dataset with reused IDs.                        |
| Submitted or queued mutation  | Capture intent and generation at submission, re-read and authorize the current row at execution, then validate generation/lifetime before applying the result.                       |
| Popup dismissal               | Discard unsubmitted draft; a submitted mutation retains feature lifetime and durable error feedback.                                                                                 |
| Feature destruction           | Close its presentation, release resources, reject obsolete work and prevent late commits.                                                                                            |
| Trigger removal               | Close an anchored popover; a dialog retains feature lifetime.                                                                                                                        |

Types verify data shape and composition. Runtime ordering, rollback, injection scope and lifetime need behavioral tests in phases 2–4; the compile-only save examples do not implement those guarantees.

## Phase 1: Freeze types and executable acceptance examples

- [x] Add isolated target contracts and checked examples for nullable numbers, text, textarea, dropdown, toggle and complex actions.
- [x] Specify the small presentation open contract, owner injection, one active popup per owner, and data/ref binding.
- [x] Specify typed command intents and query parameters, with no embedded execution.
- [x] Define state ownership and reset/lifetime policies for both client strategies and server saves.
- [x] Add expected type failures for wrong component/data pairs, text/number mismatch, invalid action data, unsupported presentation options and renderer params.
- [x] Keep published docs describing the existing implementation until callers migrate.

Acceptance: npm run test:types and npm run build pass. All three save examples compile: client mutation, client transaction and server replacement. No production pipeline changes in this phase.

Completed deliverables: isolated contracts in `type-tests/editing-redesign/contracts.ts`, checked examples in `usage.ts`, and 29 expected rejection cases in `rejections.ts`. Fixtures cover nullable/zero numbers, text, textarea, object-valued dropdowns, toggles, composite capability params, complex actions, shared editor presentations, client mutation/refresh, client transactions and server dataset replacement. The checked open calls pass only the trigger; feature-scoped presentation captures injection and destruction internally. At the phase 1 checkpoint, target types were not exported from production. Phase 2 adopts the presentation contracts through the shared editor-host public entry point.

Verification: `npm run test:types` and formatting checks pass. `npm run build` passes outside the command sandbox. Sandboxed build attempts aborted before reporting a compilation result, including a reduced-worker retry. Runtime injection, state commit and lifecycle checks remain assigned to their implementation phases; phase 1 checks contract compatibility only.

## Phase 2: Extract table-independent editor presentation

- [x] Introduce the app-level editor-host module around existing PopoverService and MatDialog.
- [x] Provide EditorRef and required typed data before first render; remove bindEditorSession from migrated opening paths.
- [x] Preserve Material dialog mounting, dimensions, focus, shared Escape, scroll options, default dismissal and anchor observation.
- [x] Use feature/table owner injection and destruction; preserve dialog survival after trigger removal.
- [x] Consolidate close handling and private adapter subscriptions. Add cleanup only where it owns a real resource; do not reproduce the old table/session manager.
- [x] Keep the old opening path temporarily for unmigrated production callers. Do not add a public compatibility layer.

Acceptance: the same typed test editor opens in both presentations, resolves a feature-scoped provider, closes once, and leaves no orphan overlays. Test initialization failure, dismissal during initialization, owner destruction, old-reference close, anchor loss and focus restoration.

Completed deliverables: `src/app/shared/grid-cells/editing/editor-host/public-api.ts` exposes EditorHostService, EditorRef, HostedEditor, typed definitions and presentation options. The table-scoped host captures injector/lifetime once and performs no row or persistence operations. Private data binding supports aliased required signal inputs. Material panel code is shared with the current grid opener; the old DialogOptions import path re-exports the shared type until phase 6. Target fixtures now use the production presentation contracts. `docs/editor-host.md` describes the module, and `type-tests/docs/editor-host-example.ts` checks actual Angular consumer metadata/templates.

Verification: 28 new host lifecycle tests pass; the full unit suite passes with 208 tests across 36 files. Production build, `npm run test:types`, formatting and whitespace checks pass. All 9 existing presentation browser tests pass, including the dialog AXE check. Browser regressions exercise the current grid opener and shared Material panel; the new host's binding, ownership, dismissal and initialization failures are exercised directly by unit tests. Its grid renderer integration remains phase 5.

## Phase 3: Implement feature persistence and authoritative server commits

- [x] Define the shared feature action contract and server providers; client providers are implemented in phase 4. Payload types remain in the feature.
- [x] Implement server actions that receive EditCommand<T>, re-read current row state, authorize, build the HTTP payload/query and commit the returned dataset.
- [x] Move required FIFO mutation sequencing and dataset generation/destruction checks into feature persistence. One feature-wide queue must cover actions capable of replacing the same dataset. It is an implementation detail, not another public submit interface.
- [x] Capture draft data and generation at submission, authorize again when execution begins, and reject obsolete queued/pending work. A failed command must not poison subsequent commands.
- [x] Preserve latest action/error feedback after popup dismissal without retaining every full dataset response.
- [x] Reject late results after reload/navigation; permit a valid response to remove the originating row. Keep feature-level backend revision rules.
- [x] Prevent an editor opened before an unrelated reset from applying an old draft to a new dataset with reused IDs. The feature reset path closes owned editors or invalidates their bound actions; the shared presentation module performs no table reconciliation.
- [x] Keep response replacement/upsert semantics in feature models. Stop requiring a shared TableUpdate/EditResult protocol for new actions.

Acceptance: multi-row recalculation and deletion commit correctly; failed saves preserve committed state; cross-action ordering, reset during request, stale open drafts and feature destruction cannot overwrite the new dataset. A save dismissed while pending still commits or reports failure.

Completed deliverables: production command types in `editing/edit-command.model.ts`; feature intents, token and feedback in `demo-persistence.model.ts`; `DemoServerPersistence` directly authorizes, builds HTTP payloads and commits feature response models through `DemoTableState.commitServerUpdate`. `provideDemoServerEditing` installs one feature-scoped host/state/persistence instance. Scalar intents use current row data; details and approval require a current numeric revision. Approval submits the details draft to its distinct POST endpoint. The feature owns its response replacement/upsert types; new server actions do not consume the shared TableUpdate/EditResult protocol. The old API path still accepts its existing patch format until migration.

The feature queue snapshots intents and query arrays, serializes all row-set mutations, rechecks generation before execution and commit, and settles callers on destruction. Reset closes the feature host without putting row reconciliation into presentation. Feedback retains only the last origin/action and outcome. The current grid opener/persistence path remains in place until phase 5; new actions are independently usable through the feature token.

Verification: 20 new persistence tests pass. The full unit suite passes with 228 tests across 37 files. Production build, `npm run test:types`, formatting and whitespace checks pass. Eight existing server/table-update browser regressions pass. New feature actions are exercised directly by HTTP/state tests; browser tests continue to exercise the existing grid wiring. `type-tests/editing-redesign/server-feature.ts` checks production action types, and [feature persistence](feature-persistence.md) describes the implemented module.

## Phase 4: Implement both client update strategies

- [x] Add a feature-selected client strategy, with transaction as the demo default and mutation as an explicit supported mode. The editor and command shape are identical for both.
- [x] Establish one canonical row source and one grid synchronization path per table. Ordinary transaction commits must not also drive a reactive rowData replacement. Separate full reset/replacement handling from incremental edit synchronization.
- [x] Mutation path: update the current mutable row, publish the required application-state notification, and force-refresh affected renderer categories. Use signal.set/update where signals notify consumers, never signal.mutate.
- [x] Restrict direct row mutation to mutable state ownership. Document immutable signal/NgRx state as requiring immutable updates.
- [x] Transaction path: create a new full row with unchanged ID, commit it to application state, and applyTransaction({ update: [row] }) once. Match by getRowId; replace affected nested objects rather than mutating shared drafts.
- [x] Handle metadata-only marker/permission changes with targeted forced refresh. Include dependent columns/rows where local calculations affect them. Handle sorting/filtering/grouping and value-cache invalidation if enabled.
- [x] Validate row existence and permissions before commit. Handle a disconnected/destroyed grid and transaction rejection explicitly, without leaving application state and grid inconsistent.
- [x] Keep the state/grid commit sequence inside feature persistence or a private feature helper. No generic commands-to-patches adapter.

Acceptance: both strategies save zero/null values, update markers, refresh compatible renderers, update dependent data, preserve row IDs, and keep canonical state equal to grid data. Verify one transaction per edit, no duplicate rowData synchronization, and the expected sorting/filtering/grouping behavior.

Completed deliverables: `DemoClientPersistence` implements the same feature action contract as server persistence. `provideDemoClientEditing` selects transaction by default or explicit mutation. Private `demo-edit-intent.ts` shares domain authorization and draft validation between the two implementations. `DemoTableState.connectGrid` gives the feature one grid synchronization path; connected tables omit a reactive rowData binding. Full reset/server replacements and incremental client commits use distinct methods on the private `DemoGridUpdates` implementation.

Both strategies calculate normalized values, increment revision and include the dependent row. Transactions issue one checked update; mutation preserves owned row references and publishes a new array. Reset and response inputs are copied into ownership so external frozen/store rows are never mutated. The state signal is read-only to consumers. Cache expiry covers commits, full replacements and failure recovery. Transactions use their automatic row-model update unless suppressed; direct mutation explicitly recomputes grouping/filtering/aggregation/sorting. A targeted forced refresh includes all columns in affected rows because metadata can alter any marker or permission. Partial transactions and refresh failures restore previous grid data without publishing new state.

Verification: 22 new tests exercise both strategies against real AG Grid instances, including zero/null, dependent rows, revisions, grouping/aggregation, sorting/filtering, never-expiring value caches, suppressed automatic row-model updates, frozen input datasets, permissions, reset/destruction, transaction rejection and recovery. The full unit suite passes with 250 tests across 38 files. Production build, type checks, formatting and whitespace checks pass. Eight existing server/table-update browser regressions pass. `type-tests/docs/client-editing-example.ts` compiles actual Angular setup without a rowData binding; [feature persistence](feature-persistence.md) documents both strategies. Production renderer/editor migration and runtime mode selection remain phase 5; the new client implementations are exercised directly through feature actions in this phase.

## Phase 5: Migrate editors, renderers and inline controls

- [x] Migrate Material input/textarea to data inputs and EditorRef. Preserve validators, async validation, draft dirty feedback, pending guards and retry.
- [x] Replace buildEditCommand/session.edit.submit with one configured save(value) call. Close after the committed promise fulfills; never close a newer popup via an old reference.
- [x] Migrate PopoverCell/DialogCell to typed data factories in cellRendererParams and the reusable presentation entry point. Retain separate renderer params and explicit presentation types.
- [x] Migrate dropdown to typed data/save/ref with Material selected styling, no radio/Cancel, and outside dismissal. Preserve toggle native controls, pending feedback, permission checks and failure rollback.
- [x] Migrate DetailsEditor to its own data type and explicit feature actions; it builds a typed command per action and owns validation.
- [x] Migrate the composite toggle/number renderer without nested renderer instances or added permanent DOM.
- [x] Bind identity and column-specific query parameters in column action closures. Pass initial drafts as draft data, not authoritative whole-row save snapshots.
- [x] Use current cell params for activation; preserve BaseCell params updates and explicit independent computed categories.

Acceptance: all production edit paths use the new flow, save failure retains drafts, permissions work in renderer and persistence, and generic/complex editors work in both presentation types. Build and type fixtures enforce the component/data pairing.

Completed deliverables: field-only `FieldEditorConfig`, typed `InputEditorData`/`TextareaEditorData`, `ValueEditorData` and `CellEditorConfig` are production contracts. Material input/textarea editors receive `data`, invoke one `save(value)` callback and close their injected EditorRef after commit. PopoverCell and DialogCell build typed data from current params and call the reusable host. Toggle and dropdown configs carry direct save callbacks with independently computed permission. A control-specific permission overrides action.permission, so the composite toggle can remain enabled while its number action is denied. Dropdown expanded state derives from the host reference without a close subscription.

DetailsEditor receives its own scalar draft/identity/revision data, owns its form rules, and calls explicit saveDetails/approveDetails feature actions. The host demo editor also uses typed data and save. `provideDemoEditing` installs both real implementations for direct demo mode selection; no forwarding facade was introduced. The grid connects to canonical state and omits the reactive rowData binding. Grid context carries editorHost and application mode, and mode changes explicitly refresh visible permissions. Production columns bind identity and query parameters directly to feature methods. Composite amount saves correctly target metric 7 rather than the ordinary metric 2. The client-only review shortcut is a named feature action with persistence permission checks.

Host active/reference state supports UI guards and dropdown ARIA state. Popover focus restoration waits for rendering so a previously disabled trigger can be focused again. Removed triggers fall back to a connected previous focus target or a focusable owner control without grid lookup. Full dataset replacement explicitly force-refreshes renderer categories even when displayed values are unchanged. Resting renderer templates retain their existing element counts.

Verification: production build and type checks pass; the full unit suite passes with 256 tests across 39 files. Six additional tests cover complex action payloads, validation/pending/retry and composite metric routing in both client strategies and server persistence. Existing editor/renderer tests now exercise typed data and save callbacks. All 52 browser tests pass, including Material layouts, AXE checks, keyboard/focus/dismissal, native controls, both server/client flows, metadata refresh, stable renderer DOM, virtualization and repeated overlay cleanup. Formatting and whitespace checks pass. Built-in and composite type fixtures use the new contracts; migration-only legacy fixtures remain for phase 6. [Cell editors](cell-editors.md), [editor host](editor-host.md) and [feature persistence](feature-persistence.md) describe the implemented interfaces.

## Phase 6: Simplify integration and remove obsolete code

- [x] Remove edit/editors ports from GridContext. Keep the table-scoped editorHost reference optional for display-only tables, and allow typed application context without mandatory persistence configuration.
- [x] Make CellKit optional display/context/keyboard integration. Remove table-adapter input requirements, edit provider identity checks, connect/disconnect, row reconciliation and generic submission wiring.
- [x] Preserve keyboard callback composition and targeted metadata refresh. Require editing callers to supply the table-scoped EditorHostService through grid context; do not infer renderer lifetime as owner lifetime.
- [x] Reduce minimal consumer setup to feature persistence/state, column definitions, stable getRowId and typed context. A display-only table needs no editing providers.
- [x] Delete CellEditService, CellEditPort, EditResult, SaveOperation, ChangeConfig, buildEditCommand, generic client/server forwarding facades, CELL_EDIT_ADAPTERS, TableStateAdapter and provideCellKit once no callers depend on them.
- [x] Replace CellEditorService/EditorSession/session models and old mounting exports. Remove generic TableUpdate from the shared public contract; retain feature response models where useful.
- [x] Update public exports and all fixtures. Delete migration-only target contracts when their production counterparts exist.

Acceptance: no runtime callers depend on the old pipeline. A debugger follows renderer -> presentation -> editor, then editor -> feature action -> commit. No permanent renderer wrappers or mandatory editing integration remain.

Implemented: `GridContext` contains only an optional editorHost and can be extended with application fields. CellKit is a bare optional directive with a typed cellKitContext input, keyboard composition and visible-row metadata refresh. It no longer injects persistence/editing services, requires a table adapter, reconciles editors or owns their lifetime. The existing grid context can supply initial application fields when no directive input is configured. Changing cellKitContext removes obsolete fields and refreshes visible metadata. New Angular fixtures compile both provider-free display usage and table-scoped host context.

The shared edit services, adapter/provider protocol, session mounting contracts, command builders, generic facades and TableUpdate exports are deleted. The unused demo forwarding facade and old API-operation facade are deleted. Feature table state exposes only its actual commit/reset operations. Backend response parsing accepts validated row sets and rejects legacy patch responses. Grid activation no longer carries clickPoint; point anchoring remains available on the general app popover. TogglePart is a production composable category, and acceptance fixtures import real public contracts rather than migration-only targets. [Optional grid integration](cell-kit-integration.md) documents the resulting setup. General design/flow/usage documentation remains scheduled for phase 7.

Verification: production build and strict TypeScript/Angular template checks pass. The full unit suite passes with 205 tests across 34 files; obsolete pipeline tests were removed and state/response tests now exercise the real feature contracts. All 52 browser tests pass, including client/server edits, dataset resets, overlay cleanup, Material layouts, virtualization, stable renderer DOM, focus/dismissal and AXE checks. Formatting and whitespace checks pass.

## Phase 7: Rewrite general design, flow and usage documentation

- [x] Rewrite docs/ag-grid-cell-kit-design.md with the final folder structure, types, ownership, lifetimes and update strategies.
- [x] Rewrite docs/cell-kit-flows.md with actual file/method paths for opening, generic/complex saving, inline controls, server replacement, both client strategies, failures and reset handling.
- [x] Rewrite docs/cell-kit-usage.md with small compiling display-only/editable setups, query params, custom editors, client/server providers and an example switching client update strategies.
- [x] Update README and compile-checked documentation fixtures. Explain canonical state and grid synchronization without requiring knowledge of the migration.
- [x] Keep reader-facing docs free of discussion history and abandoned design. Keep this checklist separate as the implementation record.
- [x] Preserve dated baseline measurements and replace obsolete links.

Acceptance: documented examples compile, local links resolve, public names exist, and the documented call paths match production code.

Implemented: the design guide documents the current folder structure, composable category types, BaseCell lifecycle, CellContext/GridContext, independent computed state, renderer choices, editor data and persistence ownership. The flow guide names actual files and methods for opening, field/complex saves, direct controls, server dataset replacement, both client strategies, reset, feedback, focus and cleanup. The usage guide covers provider-free display tables, typed pen editors, markers, validation, query parameters, custom editors, feature provider selection and the two grid synchronization choices. README links the current guides and explains minimal integration.

A complete Angular-compiled AmountTableExample connects a numeric pen editor to a feature HTTP action and canonical rowData binding. ClientTableExample now includes a typed amount editor, owner host context, current permission and connected grid setup, with provider examples for transaction, mutation and server persistence. The supplementary persistence guide now describes the connected demo commit path precisely. A stale action directive comment now states its current activation responsibility. No application runtime behavior was changed. Historical baseline reports and their data remain unchanged.

Verification: production build and strict TypeScript/Angular template checks pass. All local Markdown links in README and docs resolve. Current reader-facing guides and documentation fixtures contain no references to removed editing contracts. Formatting and whitespace checks pass. Unit/browser regression and final integration verification remain phase 8 work.

## Phase 8: Verify and record completion

- [ ] Run npm run build, npm run test:types and npm run test:unit.
- [ ] Run npm run test:e2e for Material editors, popover/dialog opening, direct controls, composite cells, client strategies and backend recalculation.
- [ ] Cover metadata-only refresh, stable renderer instances, owner isolation, reset races, authorization, FIFO ordering, and errors after dismissal.
- [ ] Verify keyboard access, focus trap/restore, Escape, optional backdrops, blocking/default and scrollable popovers, internal scrolling and navigation cleanup. Run AXE checks in each presentation.
- [ ] Repeat opening/closing and verify no leaked subscriptions, orphan overlays or remaining scroll blocking.
- [ ] Inspect resting renderer DOM in the small editor showcase; do not add always-present wrappers. Inspect narrow Material layouts. Retain dated large-column benchmarks as historical evidence.
- [ ] Replace forwarding-only tests with tests through presentation and feature persistence interfaces. Retain behavioral coverage, not assertions about the removed call chain.
- [ ] Record results and any reproducible failures, and mark complete only after required checks pass.

## Execution rules

Implement one phase at a time. Keep the application building at phase boundaries. Temporary old/new paths remain internal and are removed in phase 6. Run focused checks for each changed behavior, then the full suite in phase 8. Update this checklist with actual results. Do not create a commit unless requested.

## Completion criteria

The shared kit provides typed presentation and typed command data without a generic save pipeline. Editors call feature actions directly. Server results can replace the dataset, and client edits support mutation/refresh or immutable transactions. Feature state and grid data remain consistent. Reset, concurrency, dismissal and destruction policies remain explicit. Cell composition, Material styling, accessibility and resting DOM size retain their existing behavior.
