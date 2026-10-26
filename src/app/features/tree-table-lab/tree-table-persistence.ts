import { applyChanges, type EditPersistence, type Result, type SavePayload } from '@cells';
import type { RowData } from './tree-table.model';

export const rowId = (row: RowData) => row.id;

/** Client-side rows for one table; edits stay in memory. */
export class TreeTablePersistence implements EditPersistence<RowData> {
  private rows: readonly RowData[];

  constructor(seed: () => readonly RowData[]) {
    this.rows = seed();
  }

  load(): Promise<Result<RowData>> {
    return Promise.resolve({ replace: this.rows });
  }

  save(payload: SavePayload<RowData>): Promise<Result<RowData>> {
    // Each changed field is marked as edited by a user.
    const update = applyChanges(this.rows, rowId, payload.changes).map((row) => {
      const fields = payload.changes
        .filter((change) => change.rowId === row.id)
        .map((c) => c.field);
      return { ...row, edited: [...new Set([...row.edited, ...fields])] };
    });
    const changed = new Map(update.map((row) => [row.id, row]));
    this.rows = this.rows.map((row) => changed.get(row.id) ?? row);
    return Promise.resolve({ update });
  }
}
