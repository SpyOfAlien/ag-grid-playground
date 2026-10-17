/** What a successful result changed compared with the previous successful table. */
export interface RowChanges {
  /** Rows present before and after, with the top-level fields whose values differ. */
  readonly updated: readonly { readonly rowId: string; readonly fields: readonly string[] }[];
  readonly added: readonly string[];
  readonly removed: readonly string[];
}

/**
 * Compares two tables by row id. Rows are immutable, so the same object is unchanged and is not
 * looked into; fields are compared shallowly.
 */
export function rowChanges<Row>(
  previous: readonly Row[],
  next: readonly Row[],
  rowId: (row: Row) => string,
): RowChanges {
  const before = new Map(previous.map((row) => [rowId(row), row]));
  const updated: { rowId: string; fields: string[] }[] = [];
  const added: string[] = [];
  for (const row of next) {
    const id = rowId(row);
    const was = before.get(id);
    before.delete(id);
    if (was === undefined) added.push(id);
    else if (was !== row) {
      const fields = changedFields(was, row);
      if (fields.length) updated.push({ rowId: id, fields });
    }
  }
  return { updated, added, removed: [...before.keys()] };
}

function changedFields<Row>(was: Row, row: Row): string[] {
  const old = was as Record<string, unknown>;
  const now = row as Record<string, unknown>;
  const fields: string[] = [];
  for (const key in now) if (old[key] !== now[key]) fields.push(key);
  for (const key in old) if (!(key in now)) fields.push(key);
  return fields;
}
