# Cells kit (`@cells`)

Cell renderers for AG Grid with one edit flow: a cell builds a **command**, the grid's **edit
session** runs it through a **persistence** service, and the grid shows the rows that come back.
The demo at `/cells-demo` (`src/app/features/cells-demo`) uses every part.

```
cell ──command──▶ session.run(method, command)
                    │ entry { status: 'pending' }   → every control in the grid is disabled
                    ▼
                 persistence[method](command) ──▶ { replace: rows } | { update: rows }
                    │ success: entry 'saved', rows applied to every connected grid
                    │ failure: entry 'failed', grid unchanged, error shown on the source cell
```

## Setting up a grid

```ts
@Component({ providers: [InventoryPersistence], … })
export class InventoryPage {
  readonly session = createEditSession(inject(InventoryPersistence), (item: Item) => item.sku);
  readonly options = cellGridOptions(this.session, { columnDefs: inventoryColumns() });

  constructor() {
    void this.session.run('load', {});
  }
}
// <ag-grid-angular [gridOptions]="options" />
```

- `createEditSession` must be called in the component's injection context and ends with it.
  A persistence is required.
- `cellGridOptions` is the only way to build a cell grid. It puts the session in `context`, sets
  `getRowId`, connects the grid to the session, and enables keyboard access to controls inside
  cells. `rowData` and `getRowId` are not options, because rows come from the session.
- Several grids can share one session (the demo's summary grid). Each one is disconnected when
  it is destroyed.

## Persistence

```ts
class InventoryPersistence implements EditPersistence<Item> {
  load(command?: Command): Promise<Result<Item>>; // required
  save(command: SaveCommand<Item>): Promise<Result<Item>>; // required: field changes
  approve(command: Command & { skus: string[] }): Promise<Result<Item>>; // any extra method
}
```

- Every method takes a command (`{ source?, params? }` plus its own fields) and returns either
  `{ replace }` (the full table) or `{ update }` (changed and dependent rows only).
- Client-side and server-side persistence look the same to the kit. A client persistence works
  out affected rows locally; `applyChanges(rows, rowId, changes)` helps with the field changes.
- To add or remove rows, a method does its work, reloads, and returns `{ replace }`.
- Rows must be immutable: return new objects and never change a row in place.

## Session

- `run(method, command)` is the single entry point for cells, editors and page UI. It is checked
  at compile time: the method must exist and the command must match its parameter.
- Only one command runs at a time. While one is pending, `run` is refused and controls are
  disabled. Nothing runs after the owning component is destroyed.
- `entries` is the history. Each entry has `previousId` (the entry just before it) and, on
  success, the full table it produced. Rows are shared by reference, not copied. `current` is the
  latest successful entry and `rows` its table.
- `errorFor(cell)` is the cell's last failure, cleared by its next success.
- `lock(reason)` / `unlock()` disable every control with that reason.

## Columns

Columns are plain `ColDef`s. Renderer params are checked with `satisfies`:

```ts
{
  field: 'qty',
  cellRenderer: PopoverCell,
  cellRendererParams: {
    format: (qty) => `${qty} pcs`,
    editable: ({ row }) => (row.approved ? 'Approved items are locked' : true),
    editor: { component: FieldEditor<Item, number>, data: () => ({ label: 'Quantity', mode: 'number' }) },
    popover: { title: 'Edit quantity' },
  } satisfies PopoverCellParams<Item, number, InventoryPersistence, FieldEditorData<Item, number>>,
}
```

| Renderer       | Shows                            | Edits                                           |
| -------------- | -------------------------------- | ----------------------------------------------- |
| `TextCell`     | text                             | —                                               |
| `NumberCell`   | number with locale/decimals/unit | —                                               |
| `ToggleCell`   | switch                           | saves the opposite value directly               |
| `DropdownCell` | selected label or placeholder    | options in a popover; the current option closes |
| `PopoverCell`  | text and a pen                   | the column's editor in a popover                |
| `DialogCell`   | text and a pen                   | the column's editor in a dialog                 |

Every renderer accepts `format`, `tooltip`, `highlighted`, `muted` and `markers`. Rules are a value
or a function of the cell (`{ rowId, columnId, row, value }`).

- **Text.** `format(value, cell)` is also called for empty values. It changes only what is drawn;
  the cell value, and therefore export, stays raw.
- **Markers.** Six fixed kinds in priority order: `error`, `warning`, `userEdited`,
  `systemGenerated`, `info`, `special`. Only the highest active one is drawn, with its tooltip.
- **Editing.** `editable` returns `true` or the reason it is not allowed. `method` defaults to
  `save`. `command(next, cell)` defaults to a `save` that sets the column's own top-level field.
  The source cell is always attached.
- **Disabled and tooltip order.** Session lock or "Saving…" (a pending save keeps the normal
  tooltip), then the `editable` reason, then this cell's last error (the control stays enabled for
  retry), then the normal tooltip.
- **Placeholders.** `withPlaceholder({ value, placeholder, renderer, params })` decides per cell
  whether to show text such as `-` or `NA`. The placeholder becomes the cell value, so Excel
  exports exactly what is shown, and the renderer is skipped for it.
- **Alignment** is a column class: `cellClass: 'cells-align-end'`.

## Tooltips

All kit tooltips go through one shared tooltip that behaves and looks like Angular Material's
`matTooltip`, without its per-element cost:

- A `tooltip` rule (and a marker's `tooltip`) returns text or `{ html: '<b>…</b>' }`. HTML is
  sanitized by Angular before it is shown. Disabled reasons, "Saving…" and errors are text.
- `tooltipPosition` places a column's tooltips: `above`, `below` (default), `left`, `right`,
  `before` or `after` (these two follow the text direction). It flips to the opposite side when
  there is no room.
- It shows 100 ms after the pointer rests on an element, at once on keyboard focus (focus after a
  mouse click does not show it, as in Material), and after a 500 ms touch hold. While one is
  visible, moving to another element switches without a delay.
- It hides on pointer leave, blur, Escape, a click, 1.5 s after a touch is released, or when the
  element is removed. When a container scrolls it follows its element, and hides once the element
  scrolls out of view, as Material does. The pointer may move onto the tooltip without it closing,
  and a visible tooltip follows changes to its content.
- Like Material's tooltip the visible element is `aria-hidden`. While it shows, its element gets
  `aria-describedby` pointing at it (kept alongside the element's own descriptions), so screen
  readers hear it on focus. No other element carries anything.
- Custom renderers use the directive: `<button [cellsTooltip]="view.tooltip"
[cellsTooltipPosition]="view.tooltipPosition">`. It only writes attributes onto the element; nine
  document-level listeners do the rest, however many cells there are.

### Measured cost

`npx playwright test -c perf/playwright.config.ts perf/tooltip.spec.ts` drives `/tooltip-perf`:
300 rows × 200 columns, every cell with a tooltip (8,200 drawn). Dev build in Chrome, median of 5:

| Tooltip      | First render  | Scroll sweep    | JS heap         | Event listeners |
| ------------ | ------------- | --------------- | --------------- | --------------- |
| None         | 466 ms        | 2,341 ms        | 77.4 MB         | 6               |
| Cells kit    | 535 ms (+15%) | 2,623 ms (+12%) | 88.7 MB (+11.3) | 15 (+9 total)   |
| `matTooltip` | 607 ms (+30%) | 3,568 ms (+52%) | 98.9 MB (+21.5) | 8,211 (+1/cell) |

## Editors

An editor is a component with a `data` input of `EditorData` plus whatever its column adds:

```ts
{
  (value, row, submit(next), close(), session);
}
```

`submit` runs the column's command and closes the editor on success. On failure it rejects, and
the editor shows the error and stays open. `session` is there for anything else, such as running
another method. `FieldEditor` covers text, number and multi-line fields.

## Custom renderers

Extend `CellBase` and use the same parts the built-in renderers use: `displayView`, `controlView`,
`submitEdit`, `cellEditorData`, `openCellPopover` and `openCellDialog`. The demo's `ReorderCell`
puts a switch and a pen in one cell, each with its own command.

Add `class: 'cells-cell'` to the host so keyboard handling finds the controls. The kit's global
styles are in `cells.scss` (included from `src/styles.scss`) and can be themed through its
`--cells-*` custom properties.
