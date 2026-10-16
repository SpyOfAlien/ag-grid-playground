import { TestBed } from '@angular/core/testing';
import { AllCommunityModule, ModuleRegistry, createGrid, type GridApi } from 'ag-grid-community';
import { RowGroupingModule } from 'ag-grid-enterprise';
import { provideDemoClientEditing } from './demo-editing-providers';
import { DEMO_TABLE_PERSISTENCE } from './demo-persistence.model';
import { DemoTableState } from './demo-table-state';
import { createDemoRows } from './demo-fixtures';
import type { DemoRow } from './demo-row.model';

ModuleRegistry.registerModules([AllCommunityModule, RowGroupingModule]);

describe.each(['transaction', 'mutation'] as const)('Client persistence: %s', (strategy) => {
  let api: GridApi<DemoRow>;
  let container: HTMLDivElement;
  beforeEach(() =>
    TestBed.configureTestingModule({ providers: provideDemoClientEditing(strategy) }),
  );
  afterEach(() => {
    api?.destroy();
    container?.remove();
  });

  function setup() {
    const table = TestBed.inject(DemoTableState);
    const external = createDemoRows(3).map((row) => ({
      ...row,
      metadata: { ...row.metadata, reviewed: true },
    }));
    table.reset(external);
    container = document.createElement('div');
    document.body.append(container);
    api = createGrid<DemoRow>(container, {
      getRowId: ({ data }) => data.id,
      columnDefs: [
        { field: 'name', filter: 'agTextColumnFilter', sort: 'asc' },
        { colId: 'amount', valueGetter: (params) => params.data?.metrics[2], aggFunc: 'sum' },
        { colId: 'reviewed', valueGetter: (params) => params.data?.metadata.reviewed },
        { colId: 'unit', valueGetter: (params) => params.data?.metadata.unit, rowGroup: true },
      ],
      valueCache: true,
      valueCacheNeverExpires: true,
      animateRows: false,
    });
    const disconnect = table.connectGrid(api);
    return {
      table,
      external,
      disconnect,
      persistence: TestBed.inject(DEMO_TABLE_PERSISTENCE),
      cell: { rowId: external[0].id, columnId: 'metric-2' },
    };
  }

  it('commits zero/null and dependent rows, preserving IDs and notifying state once per edit', async () => {
    const { table, external, persistence, cell } = setup();
    const before = table.rows();
    const revision = before[0].metadata.revision;
    const transaction = vi.spyOn(api, 'applyTransaction');
    const replacement = vi.spyOn(api, 'setGridOption');
    const refresh = vi.spyOn(api, 'refreshCells');
    await persistence.saveAmount({ cell, data: { value: 0 } });
    expect(table.rows()).not.toBe(before);
    expect(table.rows()[0].metrics[2]).toBe(0);
    expect(table.rows()[1].metrics.at(-1)).toBe(0);
    expect(table.rows()[2]).toBe(before[2]);
    expect(table.rows()[0] === before[0]).toBe(strategy === 'mutation');
    expect(table.rows()[0].metadata.revision).toBe(revision + 1);
    expect(external[0].metrics[2]).not.toBe(0);
    for (const row of table.rows()) expect(api.getRowNode(row.id)?.data).toBe(row);
    expect(transaction).toHaveBeenCalledTimes(strategy === 'transaction' ? 1 : 0);
    expect(replacement).not.toHaveBeenCalled();
    expect(refresh.mock.calls.at(-1)?.[0]?.force).toBe(true);
    expect(refresh.mock.calls.at(-1)?.[0]?.rowNodes).toHaveLength(2);
    await persistence.saveAmount({ cell, data: { value: null } });
    expect(table.rows()[0].metrics[2]).toBeNull();
    expect(table.rows()[1].metrics.at(-1)).toBeNull();
    expect(persistence.pending()).toBe(0);
    expect(persistence.completion()?.kind).toBe('success');
  });

  it('saves the composite metric independently from the ordinary amount field', async () => {
    const { table, persistence, cell } = setup();
    const ordinaryAmount = table.rows()[0].metrics[2];
    await persistence.saveAmount({
      cell: { ...cell, columnId: 'toggle-number' },
      data: { value: 42.125 },
    });
    expect(table.rows()[0].metrics[7]).toBe(42.13);
    expect(table.rows()[0].metrics[2]).toBe(ordinaryAmount);
    expect(table.rows()[1].metrics.at(-1)).toBe(42.13);
  });

  it('invalidates cached values, recomputes groups and sort order, and applies filters', async () => {
    const { table, persistence, cell } = setup();
    const node = api.getRowNode(cell.rowId)!;
    const oldUnit = node.data!.metadata.unit;
    expect(api.getCellValue({ colKey: 'unit', rowNode: node })).toBe(oldUnit);
    await persistence.saveUnit({
      cell: { ...cell, columnId: 'unit-dropdown' },
      data: { value: oldUnit === 'kg' ? 't' : 'kg' },
    });
    expect(api.getCellValue({ colKey: 'unit', rowNode: node })).toBe(table.rows()[0].metadata.unit);
    expect(node.parent?.key).toBe(table.rows()[0].metadata.unit);
    await persistence.saveName({ cell: { ...cell, columnId: 'name' }, data: { value: 'ZZZ' } });
    const displayed: string[] = [];
    api.forEachNodeAfterFilterAndSort((item) => {
      if (item.data) displayed.push(item.data.name);
    });
    const siblings = node
      .parent!.childrenAfterSort!.filter((item) => item.data)
      .map((item) => item.data!.name);
    expect(siblings).toEqual([...siblings].sort());
    expect(siblings.at(-1)).toBe('ZZZ');
    await api.setColumnFilterModel('name', { type: 'equals', filter: 'ZZZ' });
    api.onFilterChanged();
    await persistence.saveName({ cell: { ...cell, columnId: 'name' }, data: { value: 'Other' } });
    const filtered: string[] = [];
    api.forEachNodeAfterFilterAndSort((item) => {
      if (item.data) filtered.push(item.data.id);
    });
    expect(filtered).toEqual([]);
  });

  it('recalculates the model when automatic transaction refresh is suppressed', async () => {
    const { persistence, cell } = setup();
    api.setGridOption('suppressModelUpdateAfterUpdateTransaction', true);
    await persistence.saveName({ cell: { ...cell, columnId: 'name' }, data: { value: 'ZZZ' } });
    const siblings = api
      .getRowNode(cell.rowId)!
      .parent!.childrenAfterSort!.filter((item) => item.data)
      .map((item) => item.data!.name);
    expect(siblings).toEqual([...siblings].sort());
    expect(siblings.at(-1)).toBe('ZZZ');
  });

  it('refreshes metadata permissions and rejects edits using the current review state', async () => {
    const { table, persistence, cell } = setup();
    await persistence.saveReview({
      cell: { ...cell, columnId: 'review-toggle' },
      data: { value: false },
    });
    expect(table.rows()[0].metadata.reviewed).toBe(false);
    const before = table.rows();
    await expect(persistence.saveAmount({ cell, data: { value: 8 } })).rejects.toMatchObject({
      code: 'denied',
    });
    expect(table.rows()).toBe(before);
    await persistence.saveReview({
      cell: { ...cell, columnId: 'toggle-number' },
      data: { value: true },
    });
    await persistence.saveAmount({ cell, data: { value: 8 } });
    expect(table.rows()[0].metrics[2]).toBe(8);
  });

  it('validates drafts and identity before any grid changes', async () => {
    const { table, persistence, cell } = setup();
    const before = table.rows();
    await expect(persistence.saveAmount({ cell, data: { value: Infinity } })).rejects.toMatchObject(
      { code: 'invalid-command' },
    );
    await expect(
      persistence.saveAmount({ cell: { ...cell, rowId: 'missing' }, data: { value: 1 } }),
    ).rejects.toMatchObject({ code: 'missing-row' });
    await expect(
      persistence.saveDetails({
        cell: { ...cell, columnId: 'details' },
        data: { name: 'Draft', notes: '', amount: 1, revision: -1 },
      }),
    ).rejects.toMatchObject({ code: 'revision-conflict' });
    expect(table.rows()).toBe(before);
  });

  it('saves complex drafts and approval, replacing nested data without mutating external rows', async () => {
    const { table, persistence, cell, external } = setup();
    await persistence.approveDetails({
      cell: { ...cell, columnId: 'details' },
      data: {
        name: ' Approved ',
        notes: ' Notes ',
        amount: 2.345,
        revision: table.rows()[0].metadata.revision,
      },
    });
    expect(table.rows()[0]).toMatchObject({
      name: 'Approved',
      notes: 'Notes',
      metadata: { reviewed: true, unit: 't' },
    });
    expect(table.rows()[0].metrics[2]).toBe(2.35);
    expect(table.rows()[0].metadata).not.toBe(external[0].metadata);
    expect(external[0].name).not.toBe('Approved');
  });

  it('rejects disconnected/destroyed grids and allows reconnecting', async () => {
    const { table, persistence, cell, disconnect } = setup();
    const before = table.rows();
    disconnect();
    await expect(persistence.saveAmount({ cell, data: { value: 3 } })).rejects.toMatchObject({
      code: 'grid-unavailable',
    });
    expect(table.rows()).toBe(before);
    table.connectGrid(api);
    await persistence.saveAmount({ cell, data: { value: 3 } });
    api.destroy();
    await expect(persistence.saveAmount({ cell, data: { value: 4 } })).rejects.toMatchObject({
      code: 'grid-unavailable',
    });
    expect(table.rows()[0].metrics[2]).toBe(3);
  });

  it('recovers from a partial grid failure without publishing state or retaining mutated rows', async () => {
    const { table, persistence, cell } = setup();
    const before = table.rows();
    const snapshot = structuredClone(before);
    vi.spyOn(api, 'refreshCells').mockImplementationOnce(() => {
      throw new Error('Grid refresh failed');
    });
    await expect(persistence.saveAmount({ cell, data: { value: 55 } })).rejects.toMatchObject({
      code: 'grid-unavailable',
    });
    expect(table.rows()).toBe(before);
    expect(table.rows()).toEqual(snapshot);
    for (const row of before) expect(api.getRowNode(row.id)?.data).toBe(row);
    await persistence.saveAmount({ cell, data: { value: 55 } });
    expect(table.rows()[0].metrics[2]).toBe(55);
  });

  it('recovers from grid update rejection without committing state', async () => {
    const { table, persistence, cell } = setup();
    const before = table.rows();
    const original = api.applyTransaction.bind(api);
    if (strategy === 'transaction') {
      vi.spyOn(api, 'applyTransaction').mockImplementationOnce((transaction) => {
        original({ update: transaction.update?.slice(0, 1) });
        return null;
      });
    } else {
      vi.spyOn(api, 'refreshClientSideRowModel').mockImplementationOnce(() => {
        throw new Error('Row model refresh failed');
      });
    }
    await expect(persistence.saveAmount({ cell, data: { value: 88 } })).rejects.toMatchObject({
      code: 'grid-unavailable',
    });
    expect(table.rows()).toBe(before);
    for (const row of before) expect(api.getRowNode(row.id)?.data).toBe(row);
    await persistence.saveAmount({ cell, data: { value: 88 } });
    expect(table.rows()[0].metrics[2]).toBe(88);
  });

  it('uses privately owned copies even when reset data comes from a frozen store', async () => {
    const { table, persistence, cell } = setup();
    const external = structuredClone(table.rows());
    external.forEach((row) => {
      Object.freeze(row.metrics);
      Object.freeze(row.metadata);
      Object.freeze(row);
    });
    Object.freeze(external);
    table.reset(external);
    await persistence.saveAmount({ cell, data: { value: 77 } });
    expect(table.rows()[0].metrics[2]).toBe(77);
    expect(external[0].metrics[2]).not.toBe(77);
    const group = api.getRowNode(cell.rowId)!.parent!;
    const sum = group.allLeafChildren!.reduce(
      (total, leaf) => total + (leaf.data?.metrics[2] ?? 0),
      0,
    );
    expect(group.aggData?.['amount']).toBe(sum);
  });

  it('synchronizes full resets once and rejects saves after feature destruction', async () => {
    const { table, persistence, cell } = setup();
    const replace = vi.spyOn(api, 'setGridOption');
    const node = api.getRowNode(cell.rowId)!;
    api.getCellValue({ colKey: 'unit', rowNode: node });
    const rows = createDemoRows(1).map((row) => ({
      ...row,
      metadata: { ...row.metadata, unit: 't' as const },
    }));
    table.reset(rows);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(api.getCellValue({ colKey: 'unit', rowNode: api.getRowNode(cell.rowId)! })).toBe('t');
    expect(api.getRowNode(table.rows()[0].id)?.data).toBe(table.rows()[0]);
    TestBed.resetTestingModule();
    await expect(persistence.saveAmount({ cell, data: { value: 1 } })).rejects.toMatchObject({
      code: 'feature-destroyed',
    });
  });
});
