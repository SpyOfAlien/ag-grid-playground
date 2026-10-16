import type { CellRule } from '../../core/cell-context.model';
import type { TextContentState } from '../content/content.model';

export interface NumberConfig<R, V = number> {
  locale?: string;
  decimals?: number;
  useGrouping?: boolean;
  unit?: CellRule<R, V, string | null>;
}

export interface NumberContentState extends TextContentState {
  readonly hasValue: boolean;
  readonly unit: string | null;
}
