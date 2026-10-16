import type { CellRule } from '../../core/cell-context.model';

export type MarkerKind =
  'error' | 'warning' | 'userEdited' | 'systemGenerated' | 'info' | 'special';

export interface MarkerRule<R, V> {
  when: CellRule<R, V, boolean>;
  tooltip?: CellRule<R, V, string | null>;
}

export interface MarkerPart<R, V> {
  markers?: Partial<Record<MarkerKind, MarkerRule<R, V>>>;
}

export interface MarkerState {
  readonly kind: MarkerKind;
  readonly tooltip: string | null;
}
