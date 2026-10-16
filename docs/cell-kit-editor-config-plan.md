# Editor configuration implementation plan

This is a historical plan. The current API nests numeric formatting in `content.number` and hosted editor configuration in `action.editor`. See [cell kit usage](cell-kit-usage.md) for current examples.


Status: step 1 complete. Step 2 is next. Implement this change before shared dataset/view-state work for tabbed tables. The prior editing redesign's final verification remains pending and must include these changes when resumed.

## Objective

Reduce repeated configuration for tables with many input-editor columns. Keep editor component/data contracts composable, group presentation settings with the editor opening configuration, and preserve direct feature persistence calls. Maintain current renderer DOM, permissions, validation and presentation behavior.

This work does not change shared row ownership, multi-grid synchronization, tab state, feature persistence, or EditorHostService's lifetime.

## Target configuration

The low-level component/data factory remains available for custom editors. Presentation belongs to that opening configuration, separate from the field's InputEditorConfig.

```ts
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
```

PopoverCellParams uses `editor: PopoverEditorConfig<R,V,D>` and has no top-level popover property. DialogCellParams uses `editor: DialogEditorConfig<R,V,D>` and has no top-level dialog property. ToggleNumberCell adopts PopoverEditorConfig. These remain specific types, not a universal editor/presentation union in every renderer.

```ts
const params = {
  action: { tooltip: 'Edit amount' },
  editor: {
    component: InputEditor<number>,
    data: cell => /* typed opening data */,
    popover: { width: 320 },
  },
} satisfies PopoverCellParams<Row, number, InputEditorData<number>>;
```

InputEditorConfig continues to describe only the field: mode, label, placeholder and optional synchronous/asynchronous validators. HostedEditor, EditorDefinition and ValueEditorData remain unchanged. A component can still be hosted in either presentation.

## Input editor factory

Introduce one public, pure `createInputEditorFactory<R>(defaults?)` function. Create it once when constructing a table's column definitions. It returns typed `popover(options)` and `dialog(options)` methods that produce the corresponding editor config. It introduces no DI service, registry or runtime command-processing layer.

Proposed consumer shape:

```ts
const inputs = createInputEditorFactory<Row>({
  popover: { width: 320, placement: 'bottom' },
  dialog: { width: 480 },
});

const params = {
  action: { permission: amountPermission },
  editor: inputs.popover({
    label: 'Amount',
    mode: 'number',
    validators: [Validators.min(0)],
    save: (command) => persistence.saveAmount(command),
    queryParams: { source: 'amount' },
  }),
} satisfies PopoverCellParams<Row, number, InputEditorData<number>>;
```

The input mode determines value typing. Number mode produces number-or-null data/save values; text mode produces string-or-null values. Do not infer a broad string-or-number union to accommodate an invalid save callback. Generic signatures or overloads must preserve these distinctions in the returned config.

Factory options reuse InputEditorConfig for field settings and add only save, optional queryParams and the matching presentation override. Each save receives `EditCommand<{ readonly value: V | null }>` and returns Promise<void>. Query params accept constants or a CellContext rule. If an application action expects another payload shape, its save callback maps the command directly to that action. Complex editors continue using their own low-level component/data factory.

The factory creates the default data factory. On activation it reads the current value, requires a nonempty row/column identity, captures identity and evaluated query params, and binds a save callback that constructs one typed command and calls the configured feature action directly. Zero and null retain their meaning. It does not authorize persistence, select endpoints, enqueue work, mutate rows or close editors.

Keep constants stable across columns. Shallow-merge default presentation options with per-column options; explicit column values win. A per-column popover function runs at activation with the actual trigger, and its result overrides defaults. Omitted settings retain the host's existing defaults. Do not mutate caller config or validator/query arrays.

The factory does not insert action config. Pen presence and permission remain explicit, composable ActionPart configuration. It does not override dropdown-specific popover options, change the general app popover, or introduce a universal column-definition builder. Complete column factories can build on these editor configs later.

## Files

```text
src/app/shared/grid-cells/editing/editors/
  value-editor.model.ts                    existing component/data/save types
  editor-presentation.model.ts             PopoverEditorConfig, DialogEditorConfig
  input/
    input-editor-factory.model.ts           defaults and typed helper options
    create-input-editor-factory.ts          pure factory implementation
    create-input-editor-factory.spec.ts     behavioral tests
```

Update the popover/dialog renderer param models and opening methods, composite params/opening, grid-cells/public-api.ts, demo columns and affected type/unit fixtures. Keep presentation construction in the renderer; EditorHostService receives the same EditorDefinition/EditorPresentation as today.

## Step 1: Group presentation contracts and migrate callers

- [x] Add separate PopoverEditorConfig and DialogEditorConfig types extending CellEditorConfig.
- [x] Move popover/dialog options under editor in the corresponding renderer params.
- [x] Update PopoverCell, DialogCell and ToggleNumberCell to read nested options. Keep per-activation trigger access.
- [x] Migrate demo columns, unit tests and all compile-checked consumers together. Remove old top-level properties; do not retain aliases or fallback paths.
- [x] Export the new types and add expected type rejections for misplaced options and mismatched component/data contracts.
- [x] Update current docs to use nested editor presentation settings, including low-level custom-editor examples.

Acceptance: application build and type/template checks pass. Opening behaves identically, including custom anchors, dialog dimensions and composite activation. No changes to editor data or persistence interfaces are required.

Implemented: PopoverEditorConfig and DialogEditorConfig extend the existing component/data contract and are exported publicly. PopoverCell, DialogCell and ToggleNumberCell now read presentation options from editor.popover/editor.dialog. Renderer params contain no top-level presentation settings or compatibility aliases. Demo columns, unit fixtures, typed consumers, Angular examples and current design/flow/usage/editor guides use the nested contract. The general app popover and dropdown-specific configuration are unchanged.

Verification: production build and strict TypeScript/Angular template checks pass. All 206 unit tests across 34 files pass. A new renderer behavior test checks fresh nested options and initial value after refresh, custom anchor preservation and stable pen DOM; existing dialog tests verify configured dimensions. Type rejection fixtures cover old top-level presentation settings, cross-presentation settings and incompatible editor/data contracts. Formatting, whitespace and local documentation-link checks pass. All 52 browser tests pass, including Material layouts, presentation options, focus/dismissal, client/server saves, composite routing, metadata refresh, stable resting DOM, overlay cleanup and AXE checks.

## Step 2: Implement the typed input editor factory

- [ ] Add the single table-bound factory with popover/dialog methods, reusable defaults and mode-specific types.
- [ ] Generate typed initial data and one direct EditCommand save callback; retain an escape route through low-level config for custom initial-value/data needs.
- [ ] Support optional validators, async validators, query rules and per-column presentation overrides with explicit precedence.
- [ ] Validate missing identities at activation, preserve zero/null, and avoid mutation of caller settings.
- [ ] Test current-value/identity capture, query evaluation, default overrides and trigger-based options. Verify successful/rejected saves pass through unchanged.
- [ ] Add compile-only rejection cases for wrong mode/value callbacks, incorrect query values and inappropriate presentation options. Reject accidental generic widening.

Acceptance: a text/number input column needs no hand-written component/data factory. The helper adds no DOM and no new service to the save path. Custom editor configs still compile independently.

## Step 3: Adopt the factory in examples and repeated columns

- [ ] Create shared input-editor defaults once in the demo's column construction.
- [ ] Migrate repeated text/number popover configs and the composite number editor where applicable. Keep complex dialogs and textarea config explicit unless a demonstrated need justifies a separate helper.
- [ ] Preserve each column's action permission, query params, display formatting and feature method selection.
- [ ] Rewrite the small amount-table and connected-client examples using the factory, with a low-level custom editor example retained alongside them.
- [ ] Document factory setup, mode typing, defaults/overrides and the direct save path. Show two columns sharing defaults to demonstrate the actual reduction in repeated code.

Acceptance: repeated columns declare only field differences, save binding and exceptions. The ordinary amount and composite metric routes remain correct. The docs explain factory usage without requiring migration history.

## Step 4: Verify and record completion

- [ ] Run production build, type/template checks and the relevant unit suites, then the complete unit suite.
- [ ] Run browser checks for input popover/dialog, disabled pen reasons, query payloads, composite editing, outside click, Escape, focus and AXE.
- [ ] Confirm existing server/client persistence behavior and failure retry through the generated save callbacks.
- [ ] Verify resting DOM is unchanged and editors still mount only on activation. Check narrow popover layouts and configured dimensions.
- [ ] Run formatting, whitespace and documentation-link checks; record results in this plan.

## Execution rules

Implement one step per requested turn, updating this checklist with actual results. Preserve unrelated uncommitted work. Keep the application compiling between steps. Do not create a commit unless requested. Shared row/view state for multiple tabs is separate work.
