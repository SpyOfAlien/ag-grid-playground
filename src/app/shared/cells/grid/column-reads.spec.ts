import { TestBed } from '@angular/core/testing';
import {
  AllCommunityModule,
  createGrid,
  ModuleRegistry,
  type ColDef,
  type GridApi,
  type ICellRendererComp,
  type ICellRendererParams,
} from 'ag-grid-community';
import { createEditSession } from '../session/edit-session';
import type { Command, EditPersistence, Result, SaveCommand } from '../session/persistence';
import { cellGridOptions } from './cell-grid-options';

ModuleRegistry.registerModules([AllCommunityModule]);

interface Item {
  readonly sku: string;
  readonly qty: number;
  readonly price: number;
  readonly approved: boolean;
}

const ROWS: Item[] = [
  { sku: 'A-1', qty: 5, price: 2, approved: false },
  { sku: 'B-2', qty: 0, price: 3, approved: false },
];

class FakePersistence implements EditPersistence<Item> {
  loadResult: Result<Item> = { replace: ROWS };
  saveResult: Result<Item> = { update: [] };
  load(_command?: Command): Promise<Result<Item>> {
    return Promise.resolve(this.loadResult);
  }
  save(_command: SaveCommand<Item>): Promise<Result<Item>> {
    return Promise.resolve(this.saveResult);
  }
}

/** Refresh calls per `rowId:columnId` since the last reset. */
const refreshes = new Map<string, number>();

/** Draws its value plus the stock state, which comes from another field. */
class Probe implements ICellRendererComp<Item> {
  private readonly gui = document.createElement('span');
  init(params: ICellRendererParams<Item>): void {
    this.draw(params);
  }
  getGui(): HTMLElement {
    return this.gui;
  }
  refresh(params: ICellRendererParams<Item>): boolean {
    const key = `${params.node.id}:${params.column?.getColId()}`;
    refreshes.set(key, (refreshes.get(key) ?? 0) + 1);
    this.draw(params);
    return true;
  }
  private draw(params: ICellRendererParams<Item>): void {
    this.gui.textContent = `${params.value}|${params.data?.qty ? 'in' : 'out'}`;
  }
}

const probe = (colId: string, value: ColDef<Item>['valueGetter']): ColDef<Item> => ({
  colId,
  valueGetter: value,
  cellRenderer: Probe,
});

const COLUMNS: ColDef<Item>[] = [
  probe('qty', ({ data }) => data?.qty),
  probe('total', ({ data }) => (data ? data.qty * data.price : null)),
  probe('label', ({ data }) => data?.sku),
  probe('other', ({ data }) => data?.sku),
];

/** What each column's display reads besides its own value, by column id. */
type Reads = Record<string, string[]>;

const withReads = (reads: Reads, columnDefs: ColDef<Item>[]) =>
  columnDefs.map((column) =>
    reads[column.colId ?? '']
      ? { ...column, context: { reads: reads[column.colId ?? ''] } }
      : column,
  );

async function setup(reads: Reads, columns = COLUMNS) {
  const persistence = new FakePersistence();
  const session = TestBed.runInInjectionContext(() =>
    createEditSession(persistence, (item: Item) => item.sku),
  );
  const columnDefs = withReads(reads, columns);
  const api = await new Promise<GridApi<Item>>((ready) => {
    const grid = createGrid<Item>(
      document.body.appendChild(document.createElement('div')),
      cellGridOptions(session, {
        columnDefs,
        domLayout: 'autoHeight',
        onGridReady: () => ready(grid),
      }),
    );
  });
  await session.run('load', {});
  const text = (rowId: string, colId: string) =>
    document.querySelector(`[row-id="${rowId}"] [col-id="${colId}"]`)?.textContent?.trim();
  await vi.waitFor(() => expect(text('B-2', columnDefs.at(-1)?.colId ?? '')).toContain('|out'));
  refreshes.clear();
  return { session, persistence, api, text };
}

/** Lets AG Grid finish rendering before counting. */
const rendered = () => new Promise((done) => setTimeout(done, 50));

describe('column reads', () => {
  afterEach(() => (document.body.innerHTML = ''));

  it('forces columns that read a changed field, leaves the rest to AG Grid, and refreshes each once', async () => {
    const { session, persistence, api, text } = await setup({ label: ['qty'] });

    persistence.saveResult = { update: [{ ...ROWS[1], qty: 4 }] };
    await session.run('save', { changes: [] });
    await rendered();

    expect(text('B-2', 'qty')).toBe('4|in');
    expect(text('B-2', 'label')).toBe('B-2|in');
    expect(text('B-2', 'other')).toBe('B-2|out');
    expect(Object.fromEntries(refreshes)).toEqual({ 'B-2:qty': 1, 'B-2:total': 1, 'B-2:label': 1 });
    api.destroy();
  });

  it('follows the chain through a dependent whose value changed', async () => {
    const { session, persistence, api, text } = await setup({ total: ['qty'], label: ['total'] });

    persistence.saveResult = { update: [{ ...ROWS[1], qty: 4 }] };
    await session.run('save', { changes: [] });
    await rendered();

    expect(text('B-2', 'total')).toBe('12|in');
    expect(text('B-2', 'label')).toBe('B-2|in');
    expect(Object.fromEntries(refreshes)).toEqual({ 'B-2:qty': 1, 'B-2:total': 1, 'B-2:label': 1 });
    api.destroy();
  });

  it('stops the chain at a dependent whose value did not change', async () => {
    const { session, persistence, api } = await setup({ qty: ['approved'], total: ['qty'] });

    persistence.saveResult = { update: [{ ...ROWS[1], approved: true }] };
    await session.run('save', { changes: [] });
    await rendered();

    expect(Object.fromEntries(refreshes)).toEqual({ 'B-2:qty': 1 });
    api.destroy();
  });

  it('touches only rows that changed when a reload replaces the table', async () => {
    const { session, persistence, api, text } = await setup({ label: ['qty'] });

    persistence.loadResult = { replace: [ROWS[0], { ...ROWS[1], qty: 2 }] };
    await session.run('load', {});
    await rendered();

    expect(text('B-2', 'label')).toBe('B-2|in');
    expect(Object.fromEntries(refreshes)).toEqual({ 'B-2:qty': 1, 'B-2:total': 1, 'B-2:label': 1 });
    api.destroy();
  });

  it('rejects a cycle when the grid is built', () => {
    const session = TestBed.runInInjectionContext(() =>
      createEditSession(new FakePersistence(), (item: Item) => item.sku),
    );

    expect(() =>
      cellGridOptions(session, {
        columnDefs: withReads({ qty: ['total'], total: ['qty'] }, COLUMNS),
      }),
    ).toThrow('Column reads have a cycle: total → qty → total');
  });

  it('rejects a read that is neither a column nor a field when rows arrive', async () => {
    await expect(setup({ label: ['qtty'] })).rejects.toThrow(
      'Column label reads qtty, which is neither a column nor a row field.',
    );
  });

  it('refreshes a column that shares its name with the field it reads but shows something else', async () => {
    const columns = [probe('qty', ({ data }) => data?.sku)];
    const { session, persistence, api, text } = await setup({ qty: ['qty'] }, columns);

    persistence.saveResult = { update: [{ ...ROWS[1], qty: 4 }] };
    await session.run('save', { changes: [] });
    await rendered();

    expect(text('B-2', 'qty')).toBe('B-2|in');
    expect(Object.fromEntries(refreshes)).toEqual({ 'B-2:qty': 1 });
    api.destroy();
  });
});
