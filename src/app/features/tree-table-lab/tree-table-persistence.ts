import { applyChanges, type EditPersistence, type Result, type SavePayload } from '@cells';
import type { RowData, TableRecords } from './tree-table.model';

export const rowId = (row: RowData) => row.id;

/**
 * Client-side rows for one table; edits stay in memory. It loads two records per row, as the
 * backend does: the active one, and the one as created. Saves change only the active values.
 */
export class TreeTablePersistence implements EditPersistence<RowData> {
  private rows: readonly RowData[];

  constructor(load: () => TableRecords) {
    this.rows = withOriginals(load());
  }

  load(): Promise<Result<RowData>> {
    return Promise.resolve({ replace: this.rows });
  }

  save(payload: SavePayload<RowData>): Promise<Result<RowData>> {
    const update = applyChanges(this.rows, rowId, payload.changes);
    const changed = new Map(update.map((row) => [row.id, row]));
    this.rows = this.rows.map((row) => changed.get(row.id) ?? row);
    return Promise.resolve({ update });
  }
}

/** Each active row with its original; a row without one counts as unchanged. */
function withOriginals({ active, original }: TableRecords): RowData[] {
  const originals = new Map(original.map((row) => [row.id, row]));
  return active.map((row) => ({ ...row, original: originals.get(row.id) ?? row }));
}
