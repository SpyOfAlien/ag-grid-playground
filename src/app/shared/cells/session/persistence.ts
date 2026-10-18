/** The cell a command came from. */
export interface CellRef {
  readonly rowId: string;
  readonly columnId: string;
}

export interface FieldChange<Row> {
  readonly rowId: string;
  readonly field: keyof Row & string;
  readonly value: unknown;
}

export interface SavePayload<Row> {
  readonly changes: readonly FieldChange<Row>[];
}

/** `replace` is the full table; `update` holds only the changed or dependent rows. */
export type Result<Row> =
  { readonly replace: readonly Row[] } | { readonly update: readonly Row[] };

/**
 * A grid's persistence. `load` and `save` are required; any other method with the shape
 * `(payload) => Promise<Result<Row>>` can be named by a column or called through `run`.
 */
export interface EditPersistence<Row> {
  load(): Promise<Result<Row>>;
  save(payload: SavePayload<Row>): Promise<Result<Row>>;
}

type Method = (payload: never) => Promise<Result<unknown>>;

/** Names of the methods `run` can call. */
export type MethodOf<P> = {
  [K in keyof P]: P[K] extends Method ? K : never;
}[keyof P] &
  string;

/** The payload a method takes; includes `undefined` when the method's is optional or absent. */
export type PayloadOf<P, M extends MethodOf<P>> = P[M] extends (...args: infer A) => unknown
  ? A[0]
  : never;

/** `payload` may be left out when the method takes none or an optional one. */
type PayloadField<T> = undefined extends T ? { readonly payload?: T } : { readonly payload: T };

/** One method and its payload; `source` is the cell that sent it, when a cell did. */
export type CommandTo<P, M extends MethodOf<P>> = {
  readonly method: M;
  readonly source?: CellRef;
} & PayloadField<PayloadOf<P, M>>;

/** What `run` takes and an entry keeps: a method name with the payload it accepts. */
export type Command<P> = { [M in MethodOf<P>]: CommandTo<P, M> }[MethodOf<P>];
