# Cell editors

Cell renderers supply typed opening data. The editor host presents the component; editors own drafts and validation and save through a configured callback or an explicit feature action.

## Field editors

The shared contracts keep field configuration independent from row models:

```ts
interface ValueEditorData<V, C> {
  readonly initialValue: V;
  readonly config: C;
  readonly save: (value: V) => Promise<void>;
}

interface CellEditorConfig<R, V, D> {
  readonly component: Type<HostedEditor<D>>;
  readonly data: (cell: CellContext<R, V>) => NoInfer<D>;
}
```

`InputEditor<number>` receives `InputEditorData<number>` with a number-or-null initial value, a number-mode field configuration and a number-or-null save callback. `InputEditor<string>` receives the equivalent text contract. Field configuration requires a label and supports placeholder, synchronous validators and asynchronous validators. Numeric inputs also reject non-finite values.

`TextareaEditor` receives `TextareaEditorData`. It uses a string draft, supports rows and maxLength, and retains line breaks. All fields use Angular Material form fields, inputs and buttons with Reactive Forms. Invalid or asynchronously pending validation prevents save. During save the field becomes read-only and repeated submissions are ignored; cancellation remains available.

A popover column binds identity and query parameters inside its save callback:

```ts
const params = {
  action: {
    tooltip: 'Edit amount',

    editor: {
      component: InputEditor<number>,
      data: (cell) => {
        if (!cell.rowId) throw new Error('Missing row.');
        const identity = { rowId: cell.rowId, columnId: cell.columnId };
        return {
          initialValue: cell.value ?? null,
          config: { label: 'Amount', mode: 'number' },
          save: (value) =>
            persistence.saveAmount({
              cell: identity,
              data: { value },
              queryParams: { source: 'amount-column' },
            }),
        };
      },

      presentation: {
        kind: 'popover',
        options: ({ trigger }) => ({
          anchor: { kind: 'element', element: trigger },
          placement: 'bottom',
          width: 320,
        }),
      },
    },
  },
} satisfies EditCellParams<Row, number, InputEditorData<number>>;
```

Import the field editors, data types and renderer params from `@grid-cells`. EditCell's optional action contains the typed editor; without action it renders content only. `action.editor.presentation` chooses `{ kind: 'popover' }` (the default) or `{ kind: 'dialog' }` with that kind's options, as an object or a callback receiving the cell and trigger. Both kinds call `editorHost.open` with a component, the data factory's result, explicit presentation options and the current activation trigger. Supply the table-scoped host through grid context. An empty value does not prevent opening an editor when row identity and permission are valid.

Save callbacks resolve after feature persistence commits. The editor then closes its injected EditorRef. A rejected save leaves its draft visible and displays the error for retry. Closing during a submitted save dismisses the presentation; persistence retains responsibility for the eventual commit or failure. An old reference cannot close another editor opened later.

## Direct controls and dropdowns

Toggle and dropdown configuration each has a typed `save(next, cell)` callback. The control supplies its current CellContext, and the feature binds identity to a typed command. A control-specific permission rule takes precedence over `action.permission`. Missing rows and denied permissions disable activation; disabled appearance in the content category is independent from permission.

A toggle uses a native resting button with switch semantics. It retains the committed value while saving, rejects duplicate activation and reports errors without optimistic data changes. A dropdown keeps one native trigger in its resting DOM and creates Material options only when opened. Selection submits the value and closes on success. Failed saves retain the committed selection. Disabled options are independent from control permission. Object-valued options can supply an equality function. Dropdown options have no Cancel button or trailing radio indicator; backdrop clicks and Escape dismiss the popover.

The composite ToggleNumberCell composes independent content, number, marker, toggle and action state. It has no nested renderer components. Its toggle permission can explicitly allow review changes while the number pen uses a separate permission rule.

## Complex editors

Complex editors define their own opening data and forms. They implement only `HostedEditor<D>`, inject EditorRef, and call their feature's explicit persistence actions. They do not need to implement the common value-editor data contract or accept configured validators.

The demo DetailsEditor receives cell identity, a scalar initial draft, opening revision and optional query parameters. It validates name, amount and notes internally, builds a typed command, and chooses saveDetails or approveDetails. The feature persistence implementation checks the latest row and revision and owns endpoint selection and dataset updates.

Compile-checked consumer examples are in `type-tests/public-api-usage.ts` and `type-tests/docs/usage-example/usage-example.ts`. Field editor behavior is tested in `field-editors.spec.ts`; complex action behavior is tested in `features/grid-demo/editors/details-editor.spec.ts`.
