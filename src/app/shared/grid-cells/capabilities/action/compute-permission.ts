import type { CellContext, CellRule } from '../../core/cell-context.model';
import { evaluateCellRule } from '../../core/evaluate-cell-rule';
import type { EditPermission } from './action.model';

export function computePermission<R, V>(
  cell: CellContext<R, V>,
  rule?: CellRule<R, V, EditPermission>,
): EditPermission {
  if (!cell.rowId || cell.data === undefined)
    return { allowed: false, reason: 'Row is unavailable.' };
  return evaluateCellRule(rule ?? { allowed: true }, cell);
}
