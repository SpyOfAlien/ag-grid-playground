import { toCellContext, type CellFacts } from '../../core/cell-context';
import { evaluateCellRule } from '../../core/evaluate-cell-rule';
import type { ActionPart, ActionState } from './action.model';
import { computePermission } from './compute-permission';

export function computeAction<R, V>(
  params: (CellFacts<R, V> & ActionPart<R, V>) | null,
): ActionState | null {
  if (!params) return null;
  if (!params.action || params.action.enabled === false)
    return { visible: false, disabled: false, tooltip: null };

  const cell = toCellContext(params);
  const permission = computePermission(cell, params.action.permission);

  return {
    visible: true,
    disabled: !permission.allowed,
    tooltip: permission.allowed
      ? evaluateCellRule(params.action.tooltip ?? null, cell)
      : permission.reason,
  };
}
