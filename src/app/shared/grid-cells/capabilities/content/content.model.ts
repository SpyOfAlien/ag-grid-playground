import type { NumberConfig } from '../number/number.model';
import type { CellRule } from '../../core/cell-context.model';

export interface ContentConfig<R, V> {
  number?: [NonNullable<V>] extends [number] ? NumberConfig<R, V> : never;
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
