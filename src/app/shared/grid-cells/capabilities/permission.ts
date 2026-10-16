import { evaluateCellRule, type CellContext, type CellRule } from '../core/cell-context';
import { DEFAULT_GRID_CELL_LABELS, type GridCellLabels } from '../core/labels';

export type EditPermission = { allowed: true } | { allowed: false; reason: string };

/**
 * The cell-wide edit permission. Every control uses it unless that control sets its own
 * `permission`, which replaces it for that control only. Controls never borrow each other's rules.
 */
export interface EditablePart<R, V> {
  editable?: CellRule<R, V, EditPermission>;
}

export function computePermission<R, V>(
  cell: CellContext<R, V>,
  rule?: CellRule<R, V, EditPermission>,
  labels: Pick<GridCellLabels, 'rowUnavailable'> = DEFAULT_GRID_CELL_LABELS,
): EditPermission {
  if (!cell.rowId || cell.data === undefined)
    return { allowed: false, reason: labels.rowUnavailable };
  return evaluateCellRule(rule ?? { allowed: true }, cell);
}

/** Resolves a control's own rule, falling back to the cell-wide `editable` rule. */
export function computeControlPermission<R, V>(
  params: EditablePart<R, V>,
  cell: CellContext<R, V>,
  control: CellRule<R, V, EditPermission> | undefined,
  labels?: Pick<GridCellLabels, 'rowUnavailable'>,
): EditPermission {
  return computePermission(cell, control ?? params.editable, labels);
}
