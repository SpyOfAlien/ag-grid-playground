import type { FieldChange } from './persistence';

/**
 * For client-side persistence: applies field changes to copies of the affected rows and returns
 * only those rows, ready to be returned as `{ update }`.
 */
export function applyChanges<Row>(
  rows: readonly Row[],
  rowId: (row: Row) => string,
  changes: readonly FieldChange<Row>[],
): Row[] {
  const byId = new Map(rows.map((row) => [rowId(row), row]));
  const changed = new Map<string, Row>();
  for (const { rowId: id, field, value } of changes) {
    const row = changed.get(id) ?? byId.get(id);
    if (row === undefined) throw new Error(`Row ${id} does not exist.`);
    changed.set(id, { ...row, [field]: value });
  }
  return [...changed.values()];
}
