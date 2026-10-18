import { isDevMode } from '@angular/core';
import type { Column, GridApi, IRowNode } from 'ag-grid-community';
import type { ConnectedGrid } from '../session/edit-session';
import type { RowChanges } from '../session/row-changes';
import { columnDependencyGraph, type RefreshGraph } from './column-dependencies';

/**
 * Shows session results in one grid. AG Grid refreshes cells whose own value changed; this adds
 * a forced refresh only for columns that read a changed field but whose own value did not change.
 */
export function connectGrid<Row>(api: GridApi<Row>): ConnectedGrid<Row> {
  // From the grid's own columns, so generated ids count and columns set later are followed.
  const build = () =>
    columnDependencyGraph(
      api
        .getColumns()
        ?.map((column) => ({ colId: column.getColId(), context: column.getColDef().context })) ??
        [],
    );
  let graph = build();

  // Names are column ids, falling back to a column's field.
  const column = (name: string): Column | null =>
    api.getColumn(name) ??
    api.getColumns()?.find((candidate) => candidate.getColDef().field === name) ??
    null;

  // Names in `dependsOn` are not checked at compile time; the first rows show whether each exists.
  let checked = !isDevMode();
  api.addEventListener('newColumnsLoaded', () => {
    graph = build();
    checked = !isDevMode();
  });
  const check = (rows: readonly Row[]) => {
    if (checked || !rows.length) return;
    checked = true;
    for (const { column: dependent, name } of graph.declared)
      if (!column(name) && !rows.some((row) => name in (row as object)))
        throw new Error(
          `Column ${dependent} depends on ${name}, which is neither a column nor a row field.`,
        );
  };

  return {
    show(rows) {
      check(rows);
      api.setGridOption('rowData', [...rows]);
    },
    apply(result, changes) {
      check('replace' in result ? result.replace : result.update);
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
  changes: RowChanges<Row>,
): RowSnapshot[] {
  const snapshots: RowSnapshot[] = [];
  for (const { rowId, fields: changed } of changes.updated) {
    const fields = Object.keys(changed);
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
