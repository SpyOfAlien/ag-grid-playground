import { isDevMode } from '@angular/core';
import type { Column, GridApi, IRowNode } from 'ag-grid-community';
import type { RowsView } from '../session/edit-session';
import type { Result } from '../session/persistence';
import type { RefreshGraph } from './refresh-map';

/**
 * Shows session results in one grid. AG Grid refreshes cells whose own value changed; this adds
 * a forced refresh only for declared dependents whose value did not change.
 */
export function gridView<Row>(
  api: GridApi<Row>,
  rowId: (row: Row) => string,
  graph: RefreshGraph,
): RowsView<Row> {
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
    apply(previous, result) {
      const plans = plan(api, rowId, graph, column, previous, result);
      if ('replace' in result) api.setGridOption('rowData', [...result.replace]);
      else api.applyTransaction({ update: [...result.update] });
      for (const { node, fields, before } of plans) {
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

interface RowPlan {
  readonly node: IRowNode;
  readonly fields: readonly string[];
  /** Values of every cell the change could reach, read before the rows are applied. */
  readonly before: ReadonlyMap<string, unknown>;
}

function plan<Row>(
  api: GridApi<Row>,
  rowId: (row: Row) => string,
  graph: RefreshGraph,
  column: (name: string) => Column | null,
  previous: readonly Row[],
  result: Result<Row>,
): RowPlan[] {
  const old = new Map(previous.map((row) => [rowId(row), row]));
  const plans: RowPlan[] = [];
  for (const row of 'replace' in result ? result.replace : result.update) {
    const id = rowId(row);
    const was = old.get(id);
    const node = api.getRowNode(id);
    // Immutable rows: the same object means nothing in the row changed.
    if (was === undefined || was === row || !node) continue;
    const fields = changedFields(was, row);
    const before = new Map<string, unknown>();
    for (const name of graph.reachable(fields)) {
      const target = column(name);
      if (target) before.set(name, api.getCellValue({ rowNode: node, colKey: target }));
    }
    plans.push({ node, fields, before });
  }
  return plans;
}

function changedFields<Row>(was: Row, row: Row): string[] {
  const keys = new Set([...Object.keys(was as object), ...Object.keys(row as object)]);
  return [...keys].filter(
    (key) => (was as Record<string, unknown>)[key] !== (row as Record<string, unknown>)[key],
  );
}
