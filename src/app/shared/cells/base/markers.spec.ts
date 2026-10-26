import type { Cell } from './base';
import { topMarker, type MarkerRule } from './markers';

interface Item {
  readonly qty: number;
  readonly reorderLevel: number;
}

const cell = (qty: number): Cell<Item, number> => ({
  rowId: 'SKU-01',
  columnId: 'qty',
  row: { qty, reorderLevel: 50 },
  value: qty,
});

const belowReorder: MarkerRule<Item, number> = ({ row, value }) =>
  (value ?? 0) < row.reorderLevel && `Below the reorder level of ${row.reorderLevel}`;
const empty: MarkerRule<Item, number> = ({ value }) =>
  value === 0 && 'No <stock> & nothing ordered';

describe('topMarker', () => {
  it('is null when no rule has a message', () => {
    expect(topMarker({ warning: [belowReorder, empty] }, cell(80))).toBeNull();
  });

  it('shows a single message as plain text', () => {
    expect(topMarker({ warning: [belowReorder, empty] }, cell(30))).toEqual({
      kind: 'warning',
      messages: ['Below the reorder level of 50'],
      tooltip: 'Below the reorder level of 50',
    });
  });

  it('lists every message of the kind, escaped, in the order of its rules', () => {
    const marker = topMarker({ warning: [belowReorder, empty] }, cell(0));
    expect(marker?.messages).toEqual([
      'Below the reorder level of 50',
      'No <stock> & nothing ordered',
    ]);
    expect(marker?.tooltip).toEqual({
      html:
        '<ul class="cells-tooltip-list"><li>Below the reorder level of 50</li>' +
        '<li>No &lt;stock&gt; &amp; nothing ordered</li></ul>',
    });
  });

  it('treats an empty string, false, null and undefined as no message', () => {
    const none: MarkerRule<Item, number>[] = [() => '', () => false, () => null, () => undefined];
    expect(topMarker({ error: none }, cell(0))).toBeNull();
    expect(topMarker({ error: ['', false, null, undefined] }, cell(0))).toBeNull();
  });

  it('shows a fixed message on every cell', () => {
    const markers = { systemGenerated: ['Calculated from quantity and price'] };
    expect(topMarker(markers, cell(80))?.tooltip).toBe('Calculated from quantity and price');
    expect(topMarker(markers, cell(0))?.kind).toBe('systemGenerated');
  });

  it('skips kinds that are empty or undefined', () => {
    expect(topMarker({ error: undefined, warning: [], info: [belowReorder] }, cell(30))?.kind).toBe(
      'info',
    );
  });

  it('takes the highest-priority kind and does not run lower kinds', () => {
    const lower = vi.fn((_cell: Cell<Item, number>) => 'Lower');
    const marker = topMarker({ special: [lower], error: [belowReorder] }, cell(30));
    expect(marker?.kind).toBe('error');
    expect(lower).not.toHaveBeenCalled();
  });
});
