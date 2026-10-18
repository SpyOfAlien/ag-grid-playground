// Compile-time contracts of `@cells`. Each @ts-expect-error line must fail to compile.
import {
  cellGridOptions,
  type CellColumnContext,
  createEditSession,
  type DialogCellParams,
  type DropdownCellParams,
  type EditorData,
  type EditPersistence,
  type Entry,
  type MethodOf,
  type PopoverCellParams,
  type Result,
  type SavePayload,
  type ToggleCellParams,
} from '@cells';

interface Item {
  readonly sku: string;
  readonly active: boolean;
}

declare class Inventory implements EditPersistence<Item> {
  load(): Promise<Result<Item>>;
  save(payload: SavePayload<Item>): Promise<Result<Item>>;
  approve(payload: { readonly skus: readonly string[] }): Promise<Result<Item>>;
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

// A command names a method and carries the payload that method takes.
void session.run({ method: 'approve', payload: { skus: ['A-1'] } });
void session.run({ method: 'load' });
// @ts-expect-error approve needs its payload
void session.run({ method: 'approve' });
// @ts-expect-error payloads have no shared params bag
void session.run({ method: 'approve', payload: { skus: [], params: { source: 'toolbar' } } });
// @ts-expect-error approve needs skus
void session.run({ method: 'approve', payload: { changes: [] } });
// @ts-expect-error there is no delete method
void session.run({ method: 'delete' });

// An entry keeps its command whole, so checking the method narrows the payload.
declare const entry: Entry<Item, Inventory>;
if (entry.command.method === 'approve') {
  const skus: readonly string[] = entry.command.payload.skus;
  void skus;
}
if (entry.command.method === 'save') {
  // @ts-expect-error a save payload has changes, not skus
  void entry.command.payload.skus;
}

// A cell grid needs a session, and rows only come from it.
cellGridOptions(session, { columnDefs: [] });
// @ts-expect-error the session is required
cellGridOptions({ columnDefs: [] });
// @ts-expect-error rows come from the session
cellGridOptions(session, { rowData: [] });
// @ts-expect-error row ids come from the session
cellGridOptions(session, { getRowId: () => '' });

// Dependencies live on the columns; grid options take no map.
const dependsOn = { dependsOn: ['active', 'status'] } satisfies CellColumnContext<Item>;
cellGridOptions(session, { columnDefs: [{ colId: 'badge', context: dependsOn }] });
// @ts-expect-error there is no third argument any more
cellGridOptions(session, {}, { refreshOnChange: { active: ['status'] } });

// A cell's params have three parts: markers, content and action. `action.command` picks the
// persistence method, and its payload is checked against it; no type argument names the method.
const approveToggle = {
  markers: { info: { when: true } },
  action: {
    allowed: ({ row }) => (row.active ? true : 'Inactive items are locked'),
    label: 'Approved',
    tooltip: 'Approve this item',
    command: { method: 'approve', payload: (_next, cell) => ({ skus: [cell.rowId] }) },
  },
} satisfies ToggleCellParams<Item, Inventory>;

const wrongPayload = {
  action: {
    command: {
      method: 'approve',
      // @ts-expect-error approve needs skus, not changes
      payload: () => ({ changes: [] }),
    },
  },
} satisfies ToggleCellParams<Item, Inventory>;

const unknownMethod = {
  action: {
    command: {
      // @ts-expect-error there is no delete method
      method: 'delete',
    },
  },
} satisfies ToggleCellParams<Item, Inventory>;

const approveWithoutPayload = {
  action: {
    // @ts-expect-error a command block needs its payload
    command: { method: 'approve' },
  },
} satisfies ToggleCellParams<Item, Inventory>;

const missingMethod = {
  action: {
    // @ts-expect-error a command block names its method
    command: { payload: (_next, cell) => ({ skus: [cell.rowId] }) },
  },
} satisfies ToggleCellParams<Item, Inventory>;

const toggleContent = {
  // @ts-expect-error a switch has no value text, so no content
  content: { format: () => '' },
} satisfies ToggleCellParams<Item, Inventory>;

const flatEditable = {
  // @ts-expect-error control settings live in action
  editable: true,
} satisfies ToggleCellParams<Item, Inventory>;

// Popover and dialog cells take the row, value and submitted value from the editor's data.
type CountData = EditorData<Item, number, number | null> & { readonly label: string };
declare const CountEditor: new () => {
  readonly data: import('@angular/core').InputSignal<CountData>;
};

const countPopover = {
  content: { format: (count) => `${count ?? 0} pcs`, tooltip: ({ value }) => `${value} pcs` },
  action: {
    editor: { component: CountEditor, data: () => ({ label: 'Count' }) },
    popover: { title: 'Edit count' },
    command: {
      method: 'save',
      payload: (next, cell) => ({ changes: [{ rowId: cell.rowId, field: 'active', value: next }] }),
    },
  },
  tooltipPosition: 'left',
} satisfies PopoverCellParams<CountData, Inventory>;

const countDialog = {
  action: {
    // @ts-expect-error the editor's data needs a label
    editor: { component: CountEditor, data: () => ({}) },
  },
} satisfies DialogCellParams<CountData, Inventory>;

const approveDialog = {
  action: {
    editor: { component: CountEditor },
    command: {
      method: 'approve',
      // @ts-expect-error next is number | null, not a list of skus
      payload: (next) => ({ skus: next }),
    },
  },
} satisfies DialogCellParams<CountData, Inventory>;

const dropdown = {
  content: { placeholder: 'None' },
  action: { options: [{ value: true, label: 'Yes' }], label: 'Active' },
} satisfies DropdownCellParams<Item, boolean, Inventory>;

export {
  approveDialog,
  approveToggle,
  approveWithoutPayload,
  missingMethod,
  countDialog,
  countPopover,
  dropdown,
  flatEditable,
  helper,
  methods,
  partial,
  toggleContent,
  unknownMethod,
  wrongPayload,
};
