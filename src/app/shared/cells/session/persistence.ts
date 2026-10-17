/** The cell a command came from. */
export interface CellRef {
  readonly rowId: string;
  readonly columnId: string;
}

/** Query or body parameters a column adds to its request. */
export type ApiParams = Readonly<Record<string, string | number | boolean>>;

/** Every command has this shape; each persistence method adds its own fields. */
export interface Command {
  readonly source?: CellRef;
  readonly params?: ApiParams;
}

export interface FieldChange<Row> {
  readonly rowId: string;
  readonly field: keyof Row & string;
  readonly value: unknown;
}

export interface SaveCommand<Row> extends Command {
  readonly changes: readonly FieldChange<Row>[];
}

/** `replace` is the full table; `update` holds only the changed or dependent rows. */
export type Result<Row> =
  { readonly replace: readonly Row[] } | { readonly update: readonly Row[] };

/**
 * A grid's persistence. `load` and `save` are required; any other method with the shape
 * `(command) => Promise<Result<Row>>` can be named by a column or called through `run`.
 */
export interface EditPersistence<Row> {
  load(command?: Command): Promise<Result<Row>>;
  save(command: SaveCommand<Row>): Promise<Result<Row>>;
}

type Method = (command: never) => Promise<Result<unknown>>;

/** Names of the methods `run` can call. */
export type MethodOf<P> = {
  [K in keyof P]: P[K] extends Method ? K : never;
}[keyof P] &
  string;

/** The command a method accepts. */
export type CommandOf<P, M extends MethodOf<P>> = P[M] extends (
  command: infer C extends Command | undefined,
) => unknown
  ? C
  : never;

/** The command for a method name, or `never` when the persistence has no such method. */
export type CommandFor<P, M> = M extends MethodOf<P> ? CommandOf<P, M> : never;
