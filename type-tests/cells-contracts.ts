// Compile-time contracts of `@cells`. Each @ts-expect-error line must fail to compile.
import {
  cellGridOptions,
  type CellColumnContext,
  createEditSession,
  type Command,
  type DialogCellParams,
  type EditorData,
  type EditPersistence,
  type MethodOf,
  type PopoverCellParams,
  type Result,
  type SaveCommand,
  type ToggleCellParams,
} from '@cells';

interface Item {
  readonly sku: string;
  readonly active: boolean;
}

declare class Inventory implements EditPersistence<Item> {
  load(command?: Command): Promise<Result<Item>>;
  save(command: SaveCommand<Item>): Promise<Result<Item>>;
  approve(command: Command & { readonly skus: readonly string[] }): Promise<Result<Item>>;
  toDto(item: Item): object;
}

// A persistence must offer load and save.
// @ts-expect-error save is missing
const partial: EditPersistence<Item> = { load: () => Promise.resolve({ replace: [] }) };

const persistence: Inventory = null!;
const session = createEditSession(persistence, (item: Item) => item.sku);

// @ts-expect-error a session needs a persistence
createEditSession<Item, Inventory>();

// Only methods that return a Result can be run.
const methods: MethodOf<Inventory>[] = ['load', 'save', 'approve'];
// @ts-expect-error toDto does not return a Result
const helper: MethodOf<Inventory> = 'toDto';

void session.run('approve', { skus: ['A-1'], params: { source: 'toolbar' } });
// @ts-expect-error approve needs skus
void session.run('approve', { changes: [] });
// @ts-expect-error there is no delete method
void session.run('delete', {});

// A cell grid needs a session, and rows only come from it.
cellGridOptions(session, { columnDefs: [] });
// @ts-expect-error the session is required
cellGridOptions({ columnDefs: [] });
// @ts-expect-error rows come from the session
cellGridOptions(session, { rowData: [] });
// @ts-expect-error row ids come from the session
cellGridOptions(session, { getRowId: () => '' });

// Dependencies live on the columns; grid options take no map.
const reads = { reads: ['active', 'status'] } satisfies CellColumnContext<Item>;
cellGridOptions(session, { columnDefs: [{ colId: 'badge', context: reads }] });
// @ts-expect-error there is no third argument any more
cellGridOptions(session, {}, { refreshOnChange: { active: ['status'] } });

// `method` picks the persistence method and `command` is checked against it; no type argument.
const approveToggle = {
  method: 'approve',
  command: (_next, cell) => ({ skus: [cell.rowId] }),
} satisfies ToggleCellParams<Item, Inventory>;

const wrongCommand = {
  method: 'approve',
  command: () => ({ changes: [] }),
  // @ts-expect-error approve needs skus, not changes
} satisfies ToggleCellParams<Item, Inventory>;

const unknownMethod = {
  // @ts-expect-error there is no delete method
  method: 'delete',
} satisfies ToggleCellParams<Item, Inventory>;

// @ts-expect-error a method other than save needs its own command
const approveWithoutCommand = { method: 'approve' } satisfies ToggleCellParams<Item, Inventory>;

const missingMethod = {
  command: (_next, cell) => ({ skus: [cell.rowId] }),
  // @ts-expect-error without a method this is a save, which needs changes
} satisfies ToggleCellParams<Item, Inventory>;

// Popover and dialog cells take the row, value and submitted value from the editor's data.
type CountData = EditorData<Item, number, number | null> & { readonly label: string };
declare const CountEditor: new () => {
  readonly data: import('@angular/core').InputSignal<CountData>;
};

const countPopover = {
  format: (count) => `${count ?? 0} pcs`,
  editor: { component: CountEditor, data: () => ({ label: 'Count' }) },
  command: (next, cell) => ({ changes: [{ rowId: cell.rowId, field: 'active', value: next }] }),
} satisfies PopoverCellParams<CountData, Inventory>;

const countDialog = {
  // @ts-expect-error the editor's data needs a label
  editor: { component: CountEditor, data: () => ({}) },
} satisfies DialogCellParams<CountData, Inventory>;

const approveDialog = {
  editor: { component: CountEditor },
  method: 'approve',
  // @ts-expect-error next is number | null, not a list of skus
  command: (next) => ({ skus: next }),
} satisfies DialogCellParams<CountData, Inventory>;

export {
  approveDialog,
  approveToggle,
  approveWithoutCommand,
  missingMethod,
  countDialog,
  countPopover,
  helper,
  methods,
  partial,
  unknownMethod,
  wrongCommand,
};
