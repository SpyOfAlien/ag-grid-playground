import { TestBed } from '@angular/core/testing';
import { DemoTableState } from './demo-table-state';

describe('DemoTableState', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [DemoTableState] }));

  it('replaces the dataset including deleted rows and an empty response', () => {
    const state = TestBed.inject(DemoTableState);
    const before = state.rows();
    const row = { ...before[1], name: 'Confirmed' };
    state.commitServerUpdate({ kind: 'replace-rows', rows: [row] });
    expect(state.rows()).toEqual([row]);
    expect(state.rows()[0]).not.toBe(row);
    expect(state.getRow(before[0].id)).toBeUndefined();
    expect(state.getDatasetGeneration()).toBe(0);
    state.commitServerUpdate({ kind: 'replace-rows', rows: [] });
    expect(state.rows()).toEqual([]);
  });

  it('upserts returned rows while retaining omitted rows and existing order', () => {
    const state = TestBed.inject(DemoTableState);
    const before = state.rows();
    const updated = { ...before[0], name: 'Updated' };
    const added = { ...before[1], id: 'added' };
    state.commitServerUpdate({ kind: 'upsert-rows', rows: [updated, added] });
    expect(state.rows()[0]).toEqual(updated);
    expect(state.rows()[0]).not.toBe(updated);
    expect(state.rows()[1]).toBe(before[1]);
    expect(state.rows().at(-1)).toEqual(added);
    expect(state.rows().at(-1)).not.toBe(added);
  });

  it('rejects invalid identities and client deletions atomically', () => {
    const state = TestBed.inject(DemoTableState);
    const before = state.rows();
    const row = before[0];
    expect(() => state.commitServerUpdate({ kind: 'replace-rows', rows: [row, row] })).toThrow(
      'unique',
    );
    expect(() =>
      state.commitServerUpdate({ kind: 'upsert-rows', rows: [{ ...row, id: '' }] }),
    ).toThrow('unique');
    expect(() => state.commitClientRows([row], 'transaction')).toThrow('preserve');
    expect(state.rows()).toBe(before);
  });

  it('increments generation only for an unrelated reset and validates before resetting', () => {
    const state = TestBed.inject(DemoTableState);
    const row = state.rows()[0];
    state.reset([row]);
    expect(state.getDatasetGeneration()).toBe(1);
    state.commitServerUpdate({ kind: 'replace-rows', rows: [{ ...row, name: 'Edit' }] });
    expect(state.getDatasetGeneration()).toBe(1);
    expect(() => state.reset([row, row])).toThrow('unique');
    expect(state.getDatasetGeneration()).toBe(1);
    expect(state.rows()[0].name).toBe('Edit');
  });
});
