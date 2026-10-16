import { toCellContext } from '../../core/cell-context';
import { evaluateCellRule } from '../../core/evaluate-cell-rule';
import type { CellFacts } from '../../core/cell-context';
import type { ContentPart, TextContentState } from './content.model';
import { computeContent } from './compute-content';

export function computeTextContent<R, V>(
  params: (CellFacts<R, V> & ContentPart<R, V> & { valueFormatted?: string | null }) | null,
): TextContentState | null {
  const state = computeContent(params);
  if (!params || !state) return null;
  return {
    ...state,
    text:
      params.content?.text !== undefined
        ? evaluateCellRule(params.content.text, toCellContext(params))
        : params.value == null
          ? ''
          : (params.valueFormatted ?? String(params.value)),
  };
}
