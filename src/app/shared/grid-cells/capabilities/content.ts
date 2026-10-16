import { Directive, input } from '@angular/core';
import {
  evaluateCellRule,
  toCellContext,
  type CellContext,
  type CellFacts,
  type CellRule,
} from '../core/cell-context';
import type { NumberConfig } from './number';

/** Formats a present value. Missing values render as empty text unless `content.text` is set. */
export type CellFormatter<R, V> = (value: NonNullable<V>, cell: CellContext<R, V>) => string;

export interface ContentConfig<R, V> {
  /** Built-in numeric formatter; takes precedence over `format`. */
  number?: [NonNullable<V>] extends [number] ? NumberConfig<R, V> : never;
  format?: CellFormatter<R, V>;
  /** Replaces formatted text for every value, including missing values. */
  text?: CellRule<R, V, string>;
  alignment?: CellRule<R, V, 'start' | 'center' | 'end'>;
  highlighted?: CellRule<R, V, boolean>;
  disabled?: CellRule<R, V, boolean>;
  ellipsis?: boolean;
  tooltip?: CellRule<R, V, string | null>;
}

export interface ContentPart<R, V> {
  content?: ContentConfig<R, V>;
}

export interface ContentState {
  readonly alignment: 'start' | 'center' | 'end';
  readonly highlighted: boolean;
  readonly disabled: boolean;
  readonly ellipsis: boolean;
  readonly tooltip: string | null;
}

export interface TextContentState extends ContentState {
  readonly text: string;
}

type TextParams<R, V> = CellFacts<R, V> & ContentPart<R, V> & { valueFormatted?: string | null };

export function computeContent<R, V>(
  params: (CellFacts<R, V> & ContentPart<R, V>) | null,
  cell: CellContext<R, V> | null = params && toCellContext(params),
): ContentState | null {
  if (!params || !cell) return null;
  const config = params.content;
  return {
    alignment: evaluateCellRule(config?.alignment ?? 'start', cell),
    highlighted: evaluateCellRule(config?.highlighted ?? false, cell),
    disabled: evaluateCellRule(config?.disabled ?? false, cell),
    ellipsis: config?.ellipsis ?? true,
    tooltip: evaluateCellRule(config?.tooltip ?? null, cell),
  };
}

export function computeTextContent<R, V>(
  params: TextParams<R, V> | null,
  cell: CellContext<R, V> | null = params && toCellContext(params),
): TextContentState | null {
  const state = computeContent(params, cell);
  if (!params || !cell || !state) return null;
  const { text, format } = params.content ?? {};
  const value = params.value;
  return {
    ...state,
    text:
      text !== undefined
        ? evaluateCellRule(text, cell)
        : value == null
          ? ''
          : format
            ? format(value, cell)
            : (params.valueFormatted ?? String(value)),
  };
}

/** Content directive for a text span or wrapper; controls inside it own their own tooltip. */
@Directive({
  selector: '[cellContent]',
  host: {
    class: 'grid-cell-content',
    '[style.text-align]': 'state().alignment',
    '[class.grid-cell-highlighted]': 'state().highlighted',
    '[class.grid-cell-muted]': 'state().disabled',
    '[class.grid-cell-ellipsis]': 'state().ellipsis',
    '[attr.title]': 'state().tooltip',
  },
})
export class CellContent {
  readonly state = input.required<ContentState>({ alias: 'cellContent' });
}
