import { isDevMode } from '@angular/core';
import type { Column, GridApi, IRowNode } from 'ag-grid-community';
import type { ConnectedGrid } from '../session/edit-session';
import type { RowChanges } from '../session/row-changes';
import type { RefreshGraph } from './refresh-map';

/**
 * Shows session results in one grid. AG Grid refreshes cells whose own value changed; this adds
 * a forced refresh only for declared dependents whose value did not change.
 */
export function connectGrid<Row>(api: GridApi<Row>, graph: RefreshGraph): ConnectedGrid<Row> {
  // Names are column ids, falling back to a column's field.
  const column = (name: string): Column | null =>
    api.getColumn(name) ??
    api.getColumns()?.find((candidate) => candidate.getColDef().field === name) ??
    null;
  if (isDevMode())
    for (const name of graph.targets)
      if (!column(name)) throw new Error(`refreshOnChange names an unknown column: ${name}`);

  return {
    show: (rows) => api.setGridOption('rowData', [...rows]),
    apply(result, changes) {
      const snapshots = snapshotBefore(api, graph, column, changes);
      if ('replace' in result) api.setGridOption('rowData', [...result.replace]);
      else api.applyTransaction({ update: [...result.update] });
      for (const { node, fields, before } of snapshots) {
        const forced: Column[] = [];
        const seen = new Set<string>();
        const queue = [...fields];
        for (let name = queue.shift(); name !== undefined; name = queue.shift())
          for (const dependent of graph.dependents(name)) {
            const target = column(dependent);
            if (seen.has(dependent) || !target) continue;
            seen.add(dependent);
            // A changed value was refreshed by AG Grid; its own dependents may need a refresh.
            if (api.getCellValue({ rowNode: node, colKey: target }) !== before.get(dependent))
              queue.push(dependent);
            else forced.push(target);
          }
        if (forced.length) api.refreshCells({ rowNodes: [node], columns: forced, force: true });
      }
    },
  };
}

interface RowSnapshot {
  readonly node: IRowNode;
  readonly fields: readonly string[];
  /** Values of every cell the change could reach, read before the rows are applied. */
  readonly before: ReadonlyMap<string, unknown>;
}

/** Reads, before the rows are applied, the values of every column a changed field can reach. */
function snapshotBefore<Row>(
  api: GridApi<Row>,
  graph: RefreshGraph,
  column: (name: string) => Column | null,
  changes: RowChanges,
): RowSnapshot[] {
  const snapshots: RowSnapshot[] = [];
  for (const { rowId, fields } of changes.updated) {
    const node = api.getRowNode(rowId);
    if (!node) continue;
    const before = new Map<string, unknown>();
    for (const name of graph.reachable(fields)) {
      const target = column(name);
      if (target) before.set(name, api.getCellValue({ rowNode: node, colKey: target }));
    }
    if (before.size) snapshots.push({ node, fields, before });
  }
  return snapshots;
}
