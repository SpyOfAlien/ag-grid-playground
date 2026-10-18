import { TestBed } from '@angular/core/testing';
import {
  AllCommunityModule,
  createGrid,
  ModuleRegistry,
  type ColDef,
  type GridApi,
} from 'ag-grid-community';
import { createEditSession } from '../session/edit-session';
import type { EditPersistence, Result, SavePayload } from '../session/persistence';
import { cellGridOptions } from './cell-grid-options';
import { suppressCellKeyboard } from './keyboard';

ModuleRegistry.registerModules([AllCommunityModule]);

interface Item {
  readonly sku: string;
  readonly qty: number;
}

class FakePersistence implements EditPersistence<Item> {
  loadResult: Result<Item> = {
    replace: [
      { sku: 'A-1', qty: 5 },
      { sku: 'B-2', qty: 0 },
    ],
  };
  saveResult: Result<Item> = { update: [] };
  load(): Promise<Result<Item>> {
    return Promise.resolve(this.loadResult);
  }
  save(_payload: SavePayload<Item>): Promise<Result<Item>> {
    return Promise.resolve(this.saveResult);
  }
}

function setup() {
  const persistence = new FakePersistence();
  const session = TestBed.runInInjectionContext(() =>
    createEditSession(persistence, (item: Item) => item.sku),
  );
  const grids: GridApi<Item>[] = [];
  /** Resolves once AG Grid has fired its own gridReady. */
  const mount = (columnDefs: ColDef<Item>[] = [{ field: 'sku' }, { field: 'qty' }]) =>
    new Promise<GridApi<Item>>((ready) => {
      const api = createGrid<Item>(
        document.body.appendChild(document.createElement('div')),
        cellGridOptions(session, {
          columnDefs,
          domLayout: 'autoHeight',
          onGridReady: () => ready(api),
        }),
      );
      grids.push(api);
    });
  return { persistence, session, mount, grids };
}

function shown(api: GridApi<Item>): Item[] {
  const rows: Item[] = [];
  api.forEachNode((node) => node.data && rows.push(node.data));
  return rows;
}

describe('cellGridOptions', () => {
  let cleanup: (() => void)[] = [];
  afterEach(() => {
    cleanup.forEach((destroy) => destroy());
    cleanup = [];
    document.body.innerHTML = '';
  });

  it('shows the rows a session loads', async () => {
    const { session, mount } = setup();
    const api = await mount();
    cleanup.push(() => api.destroy());

    await session.run({ method: 'load' });

    expect(shown(api)).toEqual([
      { sku: 'A-1', qty: 5 },
      { sku: 'B-2', qty: 0 },
    ]);
  });

  it('applies an update to the changed rows only', async () => {
    const { session, persistence, mount } = setup();
    const api = await mount();
    cleanup.push(() => api.destroy());
    await session.run({ method: 'load' });
    const untouched = api.getRowNode('B-2')?.data;
    persistence.saveResult = { update: [{ sku: 'A-1', qty: 7 }] };

    await session.run({ method: 'save', payload: { changes: [] } });

    expect(api.getRowNode('A-1')?.data).toEqual({ sku: 'A-1', qty: 7 });
    expect(api.getRowNode('B-2')?.data).toBe(untouched);
  });

  it('shows the current rows in a grid that connects after loading', async () => {
    const { session, mount } = setup();
    await session.run({ method: 'load' });

    const api = await mount();
    cleanup.push(() => api.destroy());

    expect(shown(api).map((item) => item.sku)).toEqual(['A-1', 'B-2']);
  });

  it('keeps every connected grid in step and lets a destroyed grid go', async () => {
    const { session, persistence, mount } = setup();
    const first = await mount();
    const second = await mount();
    cleanup.push(() => second.destroy());
    await session.run({ method: 'load' });
    expect(shown(first)).toEqual(shown(second));

    const transactions = vi.spyOn(first, 'applyTransaction');
    first.destroy();
    persistence.saveResult = { update: [{ sku: 'B-2', qty: 3 }] };
    await session.run({ method: 'save', payload: { changes: [] } });

    expect(second.getRowNode('B-2')?.data).toEqual({ sku: 'B-2', qty: 3 });
    expect(transactions).not.toHaveBeenCalled();
  });

  it('lets each grid go when two grids share one options object', async () => {
    const { session, persistence } = setup();
    let ready = 0;
    const options = cellGridOptions(session, {
      columnDefs: [{ field: 'sku' }, { field: 'qty' }],
      onGridReady: () => ready++,
    });
    const mountShared = () =>
      createGrid<Item>(document.body.appendChild(document.createElement('div')), options);
    const first = mountShared();
    const second = mountShared();
    cleanup.push(() => second.destroy());
    await vi.waitFor(() => expect(ready).toBe(2));
    await session.run({ method: 'load' });

    const transactions = vi.spyOn(first, 'applyTransaction');
    first.destroy();
    persistence.saveResult = { update: [{ sku: 'B-2', qty: 3 }] };
    await session.run({ method: 'save', payload: { changes: [] } });

    expect(second.getRowNode('B-2')?.data).toEqual({ sku: 'B-2', qty: 3 });
    expect(transactions).not.toHaveBeenCalled();
  });

  it('lets keys reach controls inside cells by default, keeping the caller defaults', () => {
    const { session } = setup();

    const options = cellGridOptions(session, { defaultColDef: { sortable: true } });

    expect(options.defaultColDef).toEqual({
      sortable: true,
      suppressKeyboardEvent: suppressCellKeyboard,
    });
  });
});
