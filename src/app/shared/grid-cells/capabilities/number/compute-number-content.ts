import { toCellContext, type CellFacts } from '../../core/cell-context';
import { evaluateCellRule } from '../../core/evaluate-cell-rule';
import type { ContentPart } from '../content/content.model';
import { computeContent } from '../content/compute-content';
import type { NumberContentState } from './number.model';
import { formatNumber } from './format-number';

export function computeNumberContent<R, V = number>(
  params: (CellFacts<R, V> & ContentPart<R, V>) | null,
): NumberContentState | null {
  const content = computeContent(params);
  if (!params || !content) return null;
  const value = params.value;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { ...content, text: '', hasValue: false, unit: null };
  }
  const cell = toCellContext(params);
  const unit = evaluateCellRule(params.content?.number?.unit ?? null, cell) || null;
  const customText = params.content?.text;
  const text =
    customText !== undefined
      ? evaluateCellRule(customText, cell)
      : formatNumber(value, params.content?.number);
  return {
    ...content,
    text: customText === undefined && unit ? `${text} ${unit}` : text,
    hasValue: true,
    unit,
  };
}
