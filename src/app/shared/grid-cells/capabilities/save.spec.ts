import { TestBed } from '@angular/core/testing';
import { CellOperations, cellSaveTarget, errorMessage, trackSave } from './save';

const cell = { rowId: 'r1', columnId: 'active' };

describe('Save tracking', () => {
  it('shares one pending save per cell and reports busy repeats', async () => {
    const operations = TestBed.runInInjectionContext(() => new CellOperations());
    let finish!: () => void;
    const first = operations.run(cell, () => new Promise<void>((resolve) => (finish = resolve)));
    expect(operations.state(cell)).toEqual({ pending: true, error: '' });
    expect(await operations.run(cell, async () => undefined)).toBe('busy');
    expect(operations.state({ rowId: 'r2', columnId: 'active' }).pending).toBe(false);
    finish();
    expect(await first).toBe('saved');
    expect(operations.state(cell)).toEqual({ pending: false, error: '' });
  });

  it('keeps a failure until the next attempt and bounds retained failures', async () => {
    const operations = new CellOperations();
    expect(await operations.run(cell, () => Promise.reject(new Error('Rejected')))).toBe('failed');
    expect(operations.state(cell)).toEqual({ pending: false, error: 'Rejected' });
    for (let index = 0; index < 300; index++)
      await operations.run({ rowId: `row-${index}`, columnId: 'c' }, () => Promise.reject('x'));
    expect(operations.state(cell).error).toBe('');
    expect(operations.state({ rowId: 'row-299', columnId: 'c' }).error).toBe('x');
  });

  it('gives a recreated tracker for the same cell the shared pending state', async () => {
    const operations = new CellOperations();
    const params = { node: { id: 'r1' }, data: {}, value: true, colDef: { colId: 'active' } };
    const target = () => cellSaveTarget({ ...params, context: { cellOperations: operations } });
    let finish!: () => void;
    const pending = trackSave(target).run(() => new Promise<void>((resolve) => (finish = resolve)));
    const recreated = trackSave(target);
    expect(recreated.state().pending).toBe(true);
    expect(await recreated.run(async () => undefined)).toBe('busy');
    finish();
    await pending;
    expect(recreated.state().pending).toBe(false);
  });

  it('falls back to local state without shared operations or a row identity', async () => {
    const tracker = trackSave(() => cellSaveTarget({ node: {}, data: undefined, value: null }));
    expect(await tracker.run(() => Promise.reject(new Error('No row')))).toBe('failed');
    expect(tracker.state()).toEqual({ pending: false, error: 'No row' });
    expect(errorMessage({ toString: () => 'custom' })).toBe('custom');
  });
});
