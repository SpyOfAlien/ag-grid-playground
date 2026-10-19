/** A field's value before and after a result. */
export interface ValueChange {
  readonly before: unknown;
  readonly after: unknown;
}

/**
 * What a successful result changed compared with the previous successful table. Values are the
 * row objects' own (rows are immutable), so keeping them costs only what changed.
 */
export interface RowChanges<Row> {
  /** Rows present before and after, with each top-level field whose value differs. */
  readonly updated: readonly {
    readonly rowId: string;
    readonly fields: Readonly<Record<string, ValueChange>>;
  }[];
  readonly added: readonly { readonly rowId: string; readonly row: Row }[];
  readonly removed: readonly { readonly rowId: string; readonly row: Row }[];
}

/**
 * Compares two tables by row id. Rows are immutable, so the same object is unchanged and is not
 * looked into; fields are compared shallowly.
 */
export function rowChanges<Row>(
  previous: readonly Row[],
  next: readonly Row[],
  rowId: (row: Row) => string,
): RowChanges<Row> {
  const before = new Map(previous.map((row) => [rowId(row), row]));
  const updated: { rowId: string; fields: Record<string, ValueChange> }[] = [];
  const added: { rowId: string; row: Row }[] = [];

  for (const row of next) {
    const id = rowId(row);
    const was = before.get(id);

    before.delete(id);

    if (was === undefined) added.push({ rowId: id, row });
    else if (was !== row) {
      const fields = changedFields(was, row);
      if (fields) updated.push({ rowId: id, fields });
    }
  }

  return { updated, added, removed: [...before].map(([id, row]) => ({ rowId: id, row })) };
}

function changedFields<Row>(was: Row, row: Row): Record<string, ValueChange> | null {
  const old = was as Record<string, unknown>;
  const now = row as Record<string, unknown>;
  let fields: Record<string, ValueChange> | null = null;

  for (const key in now)
    if (old[key] !== now[key]) (fields ??= {})[key] = { before: old[key], after: now[key] };

  // Fields missing from the new row; the first loop never visits them.
  for (const key in old)
    if (!(key in now)) (fields ??= {})[key] = { before: old[key], after: undefined };

  return fields;
}
