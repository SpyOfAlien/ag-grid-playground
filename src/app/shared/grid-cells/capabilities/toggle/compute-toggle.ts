import type { ActionPart } from '../action/action.model';
import { toCellContext, type CellFacts } from '../../core/cell-context';
import { evaluateCellRule } from '../../core/evaluate-cell-rule';
import type { ContentPart } from '../content/content.model';
import { computePermission } from '../action/compute-permission';
import type { ToggleConfig, ToggleState } from './toggle.model';

export function computeToggle<R, V>(
  params:
    | (CellFacts<R, V> & ContentPart<R, V> & ActionPart<R, V> & { toggle: ToggleConfig<R, V> })
    | null,
): ToggleState | null {
  if (!params) return null;
  const cell = toCellContext(params);
  const permission = computePermission(cell, params.toggle.permission ?? params.action?.permission);
  return {
    checked: evaluateCellRule(params.toggle.checked ?? cell.value === true, cell),
    disabled: !permission.allowed,
    tooltip: permission.allowed
      ? evaluateCellRule(params.content?.tooltip ?? null, cell)
      : permission.reason,
  };
}
