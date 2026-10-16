import type { CellContext } from './cell-context.model';

/** The subset of runtime params consumed by pure capability calculations. */
export interface CellFacts<R, V> {
  readonly value: V | null | undefined;
  readonly data: R | undefined;
  readonly node: { readonly id?: string };
  readonly column?: { getColId(): string };
  readonly colDef?: { readonly colId?: string; readonly field?: string };
}

export function toCellContext<R, V>(params: CellFacts<R, V>): CellContext<R, V> {
  return {
    rowId: params.node.id,
    columnId: params.column?.getColId() ?? params.colDef?.colId ?? params.colDef?.field ?? '',
    data: params.data,
    value: params.value,
  };
}
