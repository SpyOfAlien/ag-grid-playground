import type { CellContext } from '@grid-cells';

/** Create once per table. The placeholder is replaceable by the application's rule. */
export function createDemoUserEditedPredicate(random: () => number = Math.random) {
  const rows = new Map<string, Map<string, boolean>>();
  const predicate = <R, V>(cell: CellContext<R, V>): boolean => {
    if (!cell.rowId || !cell.columnId || cell.data === undefined) return false;
    let columns = rows.get(cell.rowId);
    if (!columns) {
      columns = new Map();
      rows.set(cell.rowId, columns);
    }
    let edited = columns.get(cell.columnId);
    if (edited === undefined) {
      edited = random() >= 0.5;
      columns.set(cell.columnId, edited);
    }
    return edited;
  };
  return Object.assign(predicate, { clear: () => rows.clear() });
}
