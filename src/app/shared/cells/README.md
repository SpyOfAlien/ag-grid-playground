# Cells kit (`@cells`)

Cell renderers for AG Grid with one edit flow: a cell builds a **command** (a method name and its payload), the
grid's **edit session** runs it through a **persistence** service, and every grid on that session shows the rows
that come back. The demo at `/cells-demo` (`src/app/features/cells-demo`) uses every part.

```
cell ──command──▶ session.run({ method, payload, source })
                    │ entry { status: 'pending' }      → every control waits ("busy")
                    ▼
                 persistence[method](payload) ──▶ { replace: rows } | { update: rows }
                    │ success: entry 'saved' with what changed; each connected grid applies it
                    │ failure: entry 'failed' with the error; grids unchanged; the page reports it
```

## Folders

| Folder       | What is in it                                                                                |
| ------------ | -------------------------------------------------------------------------------------------- |
| `session/`   | `EditSession`, the persistence contract, `rowChanges`, `applyChanges`                        |
| `grid/`      | `cellGridOptions`, `connectGrid` (one per table), column dependencies, keyboard, empty state |
| `base/`      | `CellBase` and what every renderer uses: `cellDisplay`, `cellControl`, `runCommand`          |
| `renderers/` | the six renderers and `CellMarker`                                                           |
| `editors/`   | `openCellPopover`, `openCellDialog` (`CellDialog`), `FieldEditor`, `DropdownOptions`         |
| `tooltip/`   | the shared tooltip: one service, the `cellsTooltip` directive                                |

## Setting up a grid

```ts
@Component({ providers: [InventoryPersistence], … })
export class InventoryPage {
  readonly session = createEditSession(inject(InventoryPersistence), (item: Item) => item.sku);
  readonly options = cellGridOptions(this.session, { columnDefs: inventoryColumns() });

  constructor() {
    void this.session.run({ method: 'load' });
  }
}
// <ag-grid-angular [gridOptions]="options" />
```

- `createEditSession` must be called in the component's injection context and ends with it.
  A persistence is required.
- `cellGridOptions` is the only way to build a cell grid. It puts the session in `context`, sets
  `getRowId`, connects the grid to the session, and lets keys reach controls inside cells.
  `rowData` and `getRowId` are not options, because rows come from the session.
- Several grids can share one session (the demo's summary grid). Each is connected when it is
  ready and disconnected when it is destroyed.

## Persistence

```ts
class InventoryPersistence implements EditPersistence<Item> {
  load(): Promise<Result<Item>>; // required
  save(payload: SavePayload<Item>): Promise<Result<Item>>; // required: field changes
  approve(payload: ApprovePayload): Promise<Result<Item>>; // any extra method
}
```

- Every method takes at most one payload, typed by the method itself, and returns either
  `{ replace }` (the full table) or `{ update }` (the changed rows).
- Client-side and server-side persistence look the same to the kit. A client persistence works
  out the affected rows itself; `applyChanges(rows, rowId, changes)` helps with field changes.
- Rows are immutable. Return a **new object for every row whose display changes**, including rows
  changed by another row (a tree parent whose total depends on its children), and keep unchanged
  rows as the same object. The kit relies on this to find what changed.
- To add or remove rows, a method does its work, reloads, and returns `{ replace }`.
- With NgRx, the store owns server state and the session owns grid state: a persistence that
  calls the store's methods and returns their `Result` connects the two. Effects that react to
  outside events (a push, another page) go through `session.run`, never into the store alone.

## Session

- `run({ method, payload })` is the single entry point for every change: cells, editors, page UI
  and outside events. It is checked at compile time: the method must exist and the payload must
  match its parameter; a method with no payload, or an optional one, can leave `payload` out. The
  persistence receives only the payload; `source` (the cell that sent it) stays on the entry. A
  reload from a toolbar is `session.run({ method: 'load' })`.
- One command at a time. While one runs, `busy()` is true, `run` is refused and controls wait.
  `lock(reason)` / `unlock()` disable every control with a reason, read back as `lockReason()`.
  `disabledReason()` combines both for page UI: the lock first, then "Saving…".
- Nothing runs after the owning component is destroyed.
- `entries` is the history. Each entry has `previousId` (the entry just before it, whatever its
  status), `command` (`{ method, payload, source? }`, so checking the method narrows the payload),
  `status` and, on failure, `error`. `current` is the latest
  successful entry and `rows` the current table.
- A successful entry has `changes`, compared with the previous successful table:

  ```ts
  {
    updated: [{ rowId: 'SKU-01', fields: { qty: { before: 120, after: 200 } } }],
    added: [{ rowId, row }],
    removed: [{ rowId, row }],
  }
  ```

  Rows that are the same object, or whose fields are all equal, are not listed; fields are
  compared shallowly. The values are the rows' own, so history costs only what changed. Undo is a
  command that sends the `before` values back through the persistence.

- Cells do not show failures. A failed entry keeps its `error`, and the page reports it, for
  example in a snackbar (the demo watches the latest entry). An editor that submitted the change
  also shows the error and stays open for a retry.

## Columns

Columns are plain `ColDef`s. A renderer's params have three parts, named after where they show
on the cell: **markers** in the start padding, **content** in the middle, and the **action** (the
control and what it sends). They are checked with `satisfies`:

```ts
{
  field: 'qty',
  headerName: 'Quantity',
  context: { dependsOn: ['approved', 'reorderLevel'] } satisfies CellColumnContext<Item>,
  cellRenderer: PopoverCell,
  cellRendererParams: {
    markers: {
      error: { when: ({ row, value }) => (value ?? 0) < row.reorderLevel, tooltip: 'Below reorder level' },
    },
    content: {
      format: (qty) => `${qty} pcs`,
      tooltip: ({ value }) => `${value} pieces counted`,
    },
    action: {
      allowed: ({ row }) => (row.approved ? 'Approved items are locked' : true),
      tooltip: 'Change the counted quantity',
      editor: { component: FieldEditor<Item, number>, data: () => ({ label: 'Quantity', mode: 'number' }) },
      popover: { title: 'Edit quantity' },
    },
    tooltipPosition: 'left', // optional, every tooltip of the column; defaults to below
  } satisfies PopoverCellParams<FieldEditorData<Item, number>, InventoryPersistence>,
}
```

| Renderer       | `content`                                          | `action`                                                       |
| -------------- | -------------------------------------------------- | -------------------------------------------------------------- |
| `TextCell`     | `format`, `tooltip`, `highlighted`, `muted`        | —                                                              |
| `NumberCell`   | the same plus `number` (locale, decimals, unit)    | —                                                              |
| `ToggleCell`   | — (the switch is the cell)                         | `allowed`, `label`, `tooltip`, `command`                       |
| `DropdownCell` | `tooltip`, `placeholder` (the label on the button) | the same plus `options`, `equals`; the current option closes   |
| `PopoverCell`  | `format`, `tooltip`, `highlighted`, `muted`        | the same plus `editor` and `popover`; the pen opens the editor |
| `DialogCell`   | `format`, `tooltip`, `highlighted`, `muted`        | the same plus `editor` and `dialog`                            |

Rules are a value or a function of the cell (`{ rowId, columnId, row, value }`). A rule may read
signals (page state such as a read-only switch); the cell redraws when they change, with no grid
refresh.

- **Markers.** Six fixed kinds in priority order: `error`, `warning`, `userEdited`,
  `systemGenerated`, `info`, `special`. Only the highest active one is drawn, with its tooltip, in
  the cell's start padding: text lines up whether a cell has a marker or not.
- **Content.** `format(value, cell)` is also called for empty values. It changes only what is
  drawn; the cell value, and therefore export, stays raw. `content.tooltip` is about the value;
  without one, text that is cut off shows in full on hover.
- **Action.** `allowed` returns `true` or the reason it is not. `label` is the name of what the
  control changes (default: the header), and each renderer phrases it: a switch is named "Active",
  a dropdown "Supplier: Acme…", a pen "Edit Quantity". `tooltip` is the control's hint.
- **The control's tooltip**, in order: the session lock; busy (the hint stays); the `allowed`
  reason; the hint. A dropdown is one element, so after those it falls back to `content.tooltip`
  or its cut-off label.
- **Command.** Leave `command` out to save the change to the column's own top-level field.
  Otherwise it names a persistence method and builds that method's payload from the new value,
  checked against each other:
  `command: { method: 'approve', payload: (_next, cell) => ({ skus: [cell.rowId] }) }`. An
  editor's `submit(next)` sends the same. The source cell is always attached to the command.
- **The pen** floats at the end of the cell: hidden until the cell is hovered or has keyboard
  focus, always shown on touch screens, on a backdrop that fades the text beneath it. It takes no
  room, so the content keeps its width and alignment. Switches and dropdowns always show.
- **Empty states.** `withEmptyState({ value, emptyState, renderer, params })` decides per cell
  whether to show text such as `-` or `NA` instead of the value. The empty state becomes the cell
  value, so Excel exports exactly what is shown, and the renderer is skipped for it. The answer
  is kept per row object (rows are immutable), so the rule reads only the value and the row, not
  page signals.
- **Alignment** is a column class: `cellClass: 'cells-align-end'`.

`PopoverCellParams` and `DialogCellParams` take the editor's data and the persistence; the row,
the cell value and what the editor submits all come from the editor's data.

## Refreshing only what changed

After a result, AG Grid redraws every cell whose own value changed. A cell whose value stays the
same but whose rules read another field, such as a lock reading `approved`, lists it in its
column's `dependsOn`:

```ts
{ field: 'name', context: { dependsOn: ['approved', 'discontinued'] } satisfies CellColumnContext<Item> }
```

- Names are row fields or column ids. List only direct dependencies; when a column it depends
  on changes value, the kit follows on to the columns that depend on that one.
- Each connected grid takes the changed fields from the entry's `changes`, reads the affected
  cells' values before applying the rows, and afterwards force-refreshes only those whose value did
  not change (AG Grid already redrew the rest). Columns without `dependsOn` refresh only when their
  own value changes.
- The grid reads `dependsOn` from its own columns, so a column without a `colId` or `field` counts,
  and columns set later with `setGridOption('columnDefs', …)` are followed.
- Cycles throw when the grid is built, or when columns set later bring one. A column depending on
  the field of its own name is not a cycle. In dev mode a name that is neither a column nor a field of any row throws when rows first
  arrive.
- Each table declares its own columns, so two tables on one session refresh independently.

### Measured cost

`npm run test:perf` drives `/cells-perf`: 200 columns × 300 tree rows; ten columns depend on the
field that changes. Main-thread time on a dev build in Chrome, median of 10 runs:

| Columns drawn     | Change                          | Time    | Renderer refreshes |
| ----------------- | ------------------------------- | ------- | ------------------ |
| Virtualised (555) | save, one field                 | 5.1 ms  | 4                  |
| Virtualised (555) | reload, one row differs         | 5.7 ms  | 4                  |
| All 200 (≈3,000)  | save, one field                 | 9.0 ms  | 11                 |
| All 200 (≈3,000)  | reload, one row differs         | 11.8 ms | 11                 |
| All 200 (≈3,000)  | server reload, every row is new | 15.4 ms | 11                 |

For comparison, forcing whole rows or the whole grid to refresh, as the kit first did, cost
16.6 ms (201 refreshes) for a save and 49.9 ms (7,401 refreshes) for a reload with all columns
drawn, on an earlier build.

A save costs the same after 1,000 entries as after 10 (8.7 ms and 9.2 ms with all columns): each
cell finds its error by lookup, not by reading the history.

## Tooltips

All kit tooltips go through one shared tooltip that behaves and looks like Angular Material's
`matTooltip`, without its per-element cost:

- A `tooltip` rule (content, action or marker) returns text or `{ html: '<b>…</b>' }`. HTML is
  sanitized by Angular before it is shown. Lock and `allowed` reasons are text.
- `[cellsTooltipOverflow]="true"` shows an element's own text when it, or text inside it, is cut
  off and it has no other tooltip. The kit's value text and dropdown labels use it.
- `tooltipPosition` places a column's tooltips: `above`, `below` (default), `left`, `right`,
  `before` or `after` (these two follow the text direction). It flips to the opposite side when
  there is no room.
- It shows 100 ms after the pointer rests on an element, at once on keyboard focus (focus after a
  mouse click does not show it, as in Material), and after a 500 ms touch hold. While one is
  visible, moving to another element switches without a delay.
- It hides on pointer leave, blur, Escape, a click, 1.5 s after a touch is released, or when the
  element is removed. When a container scrolls it follows its element, and hides once the element
  scrolls out of view. The pointer may move onto the tooltip without it closing, and a visible
  tooltip follows changes to its content.
- Like Material's tooltip the visible element is `aria-hidden`. While it shows, its element gets
  `aria-describedby` pointing at it (kept alongside the element's own descriptions), so screen
  readers hear it on focus.
- Elements only carry attributes (`[cellsTooltip]` writes them); nine document-level listeners
  do the rest, however many cells there are.

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

The editor never knows where it is shown. `openCellPopover` puts it in the shared popover, whose
panel draws the title and arrow; `openCellDialog` puts it in a Material dialog through
`CellDialog`, which draws the title. Both take the editor's data without `close`: the opener adds
it and closes after a successful `submit`, so a renderer only builds plain data with
`cellEditorData(params, command, cell)` plus what its editor needs.

## Custom renderers

Extend `CellBase` and use the parts the built-in renderers use:

| Part                                                  | Gives                                                      |
| ----------------------------------------------------- | ---------------------------------------------------------- |
| `cell()` (from `CellBase`)                            | `{ rowId, columnId, row, value }` as a signal              |
| `cellDisplay(params, cell)`                           | from markers and content: text, tooltip, highlight, marker |
| `cellControl(action, cell, session, defaultName)`     | one control's disabled state, tooltip and name             |
| `runCommand(params, action.command, cell, next)`      | sends the change through the session                       |
| `cellEditorData`, `openCellPopover`, `openCellDialog` | hosts an editor for the cell                               |
| `<span [cellsMarker]>`                                | the marker and its tooltip, on the renderer's own element  |
| `[cellsTooltip]`                                      | a tooltip on any element                                   |

A custom renderer's state signal is usually called `state`. The demo's `ReorderCell` puts a
switch and a pen in one cell, each with its own `action` block (`{ allowed, label, tooltip,
command }`); its pen floats at the end like the built-in ones. Add
`class: 'cells-cell'` to the host so keyboard handling finds the controls. The kit's global styles
are in `cells.scss` (included from `src/styles.scss`) and can be themed through its `--cells-*`
custom properties.
