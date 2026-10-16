import { toCellContext, type CellFacts } from '../../core/cell-context';
import { evaluateCellRule } from '../../core/evaluate-cell-rule';
import type { ContentPart, ContentState } from './content.model';

export function computeContent<R, V>(
  params: (CellFacts<R, V> & ContentPart<R, V>) | null,
): ContentState | null {
  if (!params) return null;
  const cell = toCellContext(params);
  const config = params.content;
  return {
    alignment: evaluateCellRule(config?.alignment ?? 'start', cell),
    highlighted: evaluateCellRule(config?.highlighted ?? false, cell),
    disabled: evaluateCellRule(config?.disabled ?? false, cell),
    ellipsis: config?.ellipsis ?? true,
    tooltip: evaluateCellRule(config?.tooltip ?? null, cell),
  };
}
