export interface CellContext<R, V> {
  readonly rowId: string | undefined;
  readonly columnId: string;
  readonly data: Readonly<R> | undefined;
  readonly value: V | null | undefined;
}

export type CellRule<R, V, T> = T | ((cell: CellContext<R, V>) => T);

export interface CellOpenContext<R, V> extends CellContext<R, V> {
  readonly trigger: HTMLElement;
}

/** The subset of runtime params consumed by pure capability calculations. */
export interface CellFacts<R, V> {
  readonly value: V | null | undefined;
  readonly data: R | undefined;
  readonly node: { readonly id?: string };
  readonly column?: { getColId(): string };
  readonly colDef?: {
    readonly colId?: string;
    readonly field?: string;
    readonly headerName?: string;
  };
}

interface CachedContext {
  readonly column: unknown;
  readonly colDef: unknown;
  readonly value: unknown;
  readonly data: unknown;
  readonly rowId: string | undefined;
  readonly context: CellContext<unknown, unknown>;
}

// Renderers pass one params snapshot per refresh to several capabilities; share its context.
const contexts = new WeakMap<object, CachedContext>();

export function toCellContext<R, V>(params: CellFacts<R, V>): CellContext<R, V> {
  const cached = contexts.get(params);
  // Params objects can be mutated in place, so reuse only while the facts are unchanged.
  if (
    cached &&
    cached.value === params.value &&
    cached.data === params.data &&
    cached.rowId === params.node.id &&
    cached.column === params.column &&
    cached.colDef === params.colDef
  )
    return cached.context as CellContext<R, V>;
  const context: CellContext<R, V> = {
    rowId: params.node.id,
    columnId: params.column?.getColId() ?? params.colDef?.colId ?? params.colDef?.field ?? '',
    data: params.data,
    value: params.value,
  };
  contexts.set(params, {
    column: params.column,
    colDef: params.colDef,
    value: params.value,
    data: params.data,
    rowId: params.node.id,
    context,
  });
  return context;
}

export function evaluateCellRule<R, V, T>(rule: CellRule<R, V, T>, cell: CellContext<R, V>): T {
  // Callbacks are the only function-valued rules supported by this contract.
  return typeof rule === 'function' ? (rule as (cell: CellContext<R, V>) => T)(cell) : rule;
}

/** Accessible column name used by controls that have no explicit label. */
export function columnName(params: Pick<CellFacts<unknown, unknown>, 'colDef'>): string {
  return params.colDef?.headerName ?? '';
}
