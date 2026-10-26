import { topMarker, type Cell, type MarkerRule } from '@cells';
import { buildRows } from '../../data/seed';
import type { RowData } from '../../tree-table.model';
import { withEdited } from './marker-rules';

const [row] = buildRows([{ path: ['Hub bearing'], partCode: 'HBR', safetyStock: 50 }]);
const cell = (value: number, changes: Partial<RowData> = {}): Cell<RowData, number> => ({
  rowId: row.id,
  columnId: 'stockOnHand',
  row: { ...row, ...changes },
  value,
});

const belowSafety: MarkerRule<RowData, number> = ({ row, value }) =>
  (value ?? 0) < row.safetyStock && `Below the safety stock of ${row.safetyStock}`;

describe('withEdited', () => {
  it('marks an edited field, below the column’s own error', () => {
    const markers = withEdited('stockOnHand', { error: [belowSafety] });
    expect(topMarker(markers, cell(30, { edited: ['stockOnHand'] }))?.kind).toBe('error');
    expect(topMarker(markers, cell(80, { edited: ['stockOnHand'] }))?.tooltip).toBe(
      'Edited by a user',
    );
    expect(topMarker(markers, cell(80))).toBeNull();
  });

  it('keeps the column’s own userEdited rules after its own', () => {
    const markers = withEdited('stockOnHand', { userEdited: ['Imported by hand'] });
    expect(topMarker(markers, cell(80, { edited: ['stockOnHand'] }))?.messages).toEqual([
      'Edited by a user',
      'Imported by hand',
    ]);
  });
});
