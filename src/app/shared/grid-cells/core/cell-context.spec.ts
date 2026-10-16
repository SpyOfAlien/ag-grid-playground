import { toCellContext, type CellFacts } from './cell-context';
import { evaluateCellRule } from './evaluate-cell-rule';

const row = { name: 'A' };
const params: CellFacts<typeof row, number> = {
  data: row,
  value: 0,
  node: { id: 'r1' },
  column: { getColId: () => 'amount' },
  colDef: { colId: 'fallback', field: 'name' },
};
describe('Cell context and rules', () => {
  it('maps identity and facts without copying the row', () => {
    const cell = toCellContext(params);
    expect(cell).toEqual({ rowId: 'r1', columnId: 'amount', data: row, value: 0 });
    expect(cell.data).toBe(row);
  });
  it('uses definition ID then field when there is no column instance', () => {
    expect(toCellContext({ ...params, column: undefined }).columnId).toBe('fallback');
    expect(
      toCellContext({ ...params, column: undefined, colDef: { field: 'name' } }).columnId,
    ).toBe('name');
  });
  it('tolerates missing identities, group data, and values', () => {
    expect(toCellContext({ node: {}, data: undefined, value: undefined })).toEqual({
      rowId: undefined,
      columnId: '',
      data: undefined,
      value: undefined,
    });
  });
  it('evaluates constant and callback rules with the same result', () => {
    const cell = toCellContext(params);
    expect(evaluateCellRule(true, cell)).toBe(evaluateCellRule(({ value }) => value === 0, cell));
    expect(evaluateCellRule(null, cell)).toBeNull();
  });
});
