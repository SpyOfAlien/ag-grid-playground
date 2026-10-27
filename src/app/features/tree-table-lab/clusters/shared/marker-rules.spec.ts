import { topMarker, type Cell, type MarkerRule } from '@cells';
import { buildRows } from '../../data/seed';
import type { RowData, RowRecord } from '../../tree-table.model';
import { edited, withEdited } from './marker-rules';

const [created] = buildRows([
  {
    path: ['Hub bearing'],
    partCode: 'HBR',
    stockOnHand: 80,
    safetyStock: 50,
    carrier: 'Fastline',
    emptiesTracked: false,
    packNotes: '',
  },
]);

/** The row now: `changes` since it was created, with the created row as its original. */
const rowWith = (changes: Partial<RowRecord> = {}): RowData => ({
  ...created,
  ...changes,
  original: created,
});
const cell = <V>(field: keyof RowRecord, row: RowData): Cell<RowData, V> => ({
  rowId: row.id,
  columnId: field,
  row,
  value: row[field] as V,
});

const belowSafety: MarkerRule<RowData, number> = ({ row, value }) =>
  (value ?? 0) < row.safetyStock && `Below the safety stock of ${row.safetyStock}`;

describe('edited', () => {
  it('is off while the field matches the original', () => {
    expect(edited('carrier')(cell('carrier', rowWith()))).toBe(false);
  });

  it('shows the original value once the field differs', () => {
    const row = rowWith({ stockOnHand: 30 });
    expect(edited('stockOnHand')(cell('stockOnHand', row))).toBe('Edited by a user (was 80)');
  });

  it('clears when the field is edited back to the original', () => {
    expect(edited('stockOnHand')(cell('stockOnHand', rowWith({ stockOnHand: 80 })))).toBe(false);
  });

  it('says a text, a switch and an empty value plainly', () => {
    expect(edited('carrier')(cell('carrier', rowWith({ carrier: 'Nordfrakt' })))).toBe(
      'Edited by a user (was “Fastline”)',
    );
    expect(
      edited('emptiesTracked')(cell('emptiesTracked', rowWith({ emptiesTracked: true }))),
    ).toBe('Edited by a user (was off)');
    expect(edited('packNotes')(cell('packNotes', rowWith({ packNotes: 'Keep dry' })))).toBe(
      'Edited by a user (was empty)',
    );
  });

  it('shows only the first line of a long original, shortened', () => {
    const original = {
      ...created,
      packNotes: `${'Strap every cage twice. '.repeat(3)}\nSecond line`,
    };
    const row: RowData = { ...original, packNotes: 'Keep dry', original };
    expect(edited('packNotes')(cell('packNotes', row))).toBe(
      'Edited by a user (was “Strap every cage twice. Strap every cag…”)',
    );
  });
});

describe('withEdited', () => {
  it('ranks below the column’s own error', () => {
    const markers = withEdited('stockOnHand', { error: [belowSafety] });
    expect(topMarker(markers, cell('stockOnHand', rowWith({ stockOnHand: 30 })))?.kind).toBe(
      'error',
    );
    expect(topMarker(markers, cell('stockOnHand', rowWith({ stockOnHand: 90 })))?.tooltip).toBe(
      'Edited by a user (was 80)',
    );
    expect(topMarker(markers, cell('stockOnHand', rowWith()))).toBeNull();
  });

  it('keeps the column’s own userEdited rules after its own', () => {
    const markers = withEdited('stockOnHand', { userEdited: ['Imported by hand'] });
    expect(topMarker(markers, cell('stockOnHand', rowWith({ stockOnHand: 90 })))?.messages).toEqual(
      ['Edited by a user (was 80)', 'Imported by hand'],
    );
  });
});
