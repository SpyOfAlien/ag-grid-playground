import type { ActionPart } from '../action/action.model';
import { toCellContext, type CellFacts } from '../../core/cell-context';
import { evaluateCellRule } from '../../core/evaluate-cell-rule';
import type { ContentPart } from '../content/content.model';
import { computePermission } from '../action/compute-permission';
import type { DropdownConfig, DropdownState } from './dropdown.model';

export function computeDropdown<R, V>(
  params:
    | (CellFacts<R, V> & ContentPart<R, V> & ActionPart<R, V> & { dropdown: DropdownConfig<R, V> })
    | null,
): DropdownState<V> | null {
  if (!params) return null;
  const cell = toCellContext(params);
  const config = params.dropdown;
  const options = evaluateCellRule(config.options, cell);
  const permission = computePermission(cell, config.permission ?? params.action?.permission);
  const value = cell.value;
  const selected =
    value == null
      ? undefined
      : options.find((option) => (config.equals ?? Object.is)(option.value, value));
  return {
    value,
    label: selected?.label ?? config.placeholder ?? '',
    options,
    disabled: !permission.allowed,
    tooltip: permission.allowed
      ? evaluateCellRule(params.content?.tooltip ?? null, cell)
      : permission.reason,
  };
}
