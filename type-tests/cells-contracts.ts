// Compile-time contracts of `@cells`. Each @ts-expect-error line must fail to compile.
import {
  cellGridOptions,
  createEditSession,
  type Command,
  type EditPersistence,
  type MethodOf,
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

// A column's command must match the method it names.
const approveToggle = {
  method: 'approve',
  command: (_next, cell) => ({ skus: [cell.rowId] }),
} satisfies ToggleCellParams<Item, Inventory, 'approve'>;

const wrongCommand = {
  method: 'approve',
  // @ts-expect-error approve needs skus, not changes
  command: () => ({ changes: [] }),
} satisfies ToggleCellParams<Item, Inventory, 'approve'>;

const unknownMethod = {
  // @ts-expect-error there is no delete method
  method: 'delete',
} satisfies ToggleCellParams<Item, Inventory, 'delete'>;

export { approveToggle, helper, methods, partial, unknownMethod, wrongCommand };
