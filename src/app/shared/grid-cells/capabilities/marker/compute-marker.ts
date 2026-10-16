import { toCellContext, type CellFacts } from '../../core/cell-context';
import { evaluateCellRule } from '../../core/evaluate-cell-rule';
import type { MarkerKind, MarkerPart, MarkerState } from './marker.model';

const PRIORITY: readonly MarkerKind[] = [
  'error',
  'warning',
  'userEdited',
  'systemGenerated',
  'info',
  'special',
];
export function computeMarker<R, V>(
  params: (CellFacts<R, V> & MarkerPart<R, V>) | null,
): MarkerState | null {
  if (!params?.markers) return null;
  const cell = toCellContext(params);
  for (const kind of PRIORITY) {
    const rule = params.markers[kind];
    if (rule && evaluateCellRule(rule.when, cell)) {
      return { kind, tooltip: evaluateCellRule(rule.tooltip ?? null, cell) };
    }
  }
  return null;
}
