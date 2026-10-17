import { applyChanges } from './apply-changes';

interface Item {
  readonly sku: string;
  readonly qty: number;
  readonly name: string;
}

const rows: readonly Item[] = [
  { sku: 'A-1', qty: 5, name: 'Bolt' },
  { sku: 'B-2', qty: 0, name: 'Nut' },
];

describe('applyChanges', () => {
  it('returns new objects for changed rows only and never mutates the input', () => {
    const changed = applyChanges(rows, (item) => item.sku, [
      { rowId: 'B-2', field: 'qty', value: 3 },
      { rowId: 'B-2', field: 'name', value: 'Hex nut' },
    ]);

    expect(changed).toEqual([{ sku: 'B-2', qty: 3, name: 'Hex nut' }]);
    expect(rows[1]).toEqual({ sku: 'B-2', qty: 0, name: 'Nut' });
  });

  it('rejects a change for a row that does not exist', () => {
    expect(() =>
      applyChanges(rows, (item) => item.sku, [{ rowId: 'Z-9', field: 'qty', value: 1 }]),
    ).toThrow('Row Z-9 does not exist.');
  });
});
