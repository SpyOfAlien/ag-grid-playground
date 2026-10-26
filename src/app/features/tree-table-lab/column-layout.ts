// Column defs per table (built once, never change) and the column state each view applies.
import type { ColumnState } from 'ag-grid-community';
import { clusterDefs } from './clusters';
import { allClustersForTable, clustersInScope, resolveView } from './views';
import {
  isGroup,
  leafIds,
  type ClusterId,
  type ColNode,
  type Group,
  type SavedColumn,
  type TableType,
  type ViewState,
} from './tree-table.model';

interface TableColumns {
  readonly clusters: Record<ClusterId, Group>;
  /** What the grid gets: every cluster the table can show. */
  readonly defs: Group[];
  /** Each column's own default hide (initialHide) and width. */
  readonly defaults: Map<string, { hide: boolean; width?: number }>;
}

const cache = new Map<TableType, TableColumns>();

/** Out-of-scope columns of the default view start hidden, so nothing flashes on load. */
const withStartHide = (node: ColNode, inScope: Set<string>): ColNode =>
  isGroup(node)
    ? { ...node, children: node.children.map((child) => withStartHide(child as ColNode, inScope)) }
    : { ...node, initialHide: !!node.initialHide || !inScope.has(node.colId!) };

const collectDefaults = (node: ColNode, into: TableColumns['defaults']): void => {
  if (isGroup(node))
    return node.children.forEach((child) => collectDefaults(child as ColNode, into));
  into.set(node.colId!, { hide: !!node.initialHide, width: node.initialWidth ?? node.width });
};

function tableColumns(table: TableType): TableColumns {
  let columns = cache.get(table);
  if (!columns) {
    const clusters = clusterDefs(table);
    const defaults: TableColumns['defaults'] = new Map();
    Object.values(clusters).forEach((cluster) => collectDefaults(cluster, defaults));
    const inScope = new Set(columnIdsInScope(table, resolveView(table), clusters));
    const defs = allClustersForTable(table).map(
      (id) => withStartHide(clusters[id], inScope) as Group,
    );
    columns = { clusters, defs, defaults };
    cache.set(table, columns);
  }
  return columns;
}

export const columnsByTable = (table: TableType): Group[] => tableColumns(table).defs;

export function columnIdsInScope(
  table: TableType,
  view?: ViewState,
  clusters = tableColumns(table).clusters,
): string[] {
  return clustersInScope(table, view).flatMap((id) => leafIds(clusters[id]));
}

/** Saved per user + table + mode + sub-mode. */
export const layoutKey = (table: TableType, view?: ViewState): string =>
  !view
    ? `${table}:default`
    : view.subMode
      ? `${table}:${view.mode}:${view.subMode}`
      : `${table}:${view.mode}`;

/** In scope: saved hide, width and order, else the column's defaults. Out of scope: hidden. */
export function buildColumnState(
  table: TableType,
  view: ViewState | undefined,
  saved?: readonly SavedColumn[],
): ColumnState[] {
  const { defs, defaults } = tableColumns(table);
  const inScope = columnIdsInScope(table, view);
  const inScopeSet = new Set(inScope);
  const savedById = new Map((saved ?? []).map((column) => [column.colId, column]));

  const ordered = [
    ...(saved ?? []).map((column) => column.colId).filter((id) => inScopeSet.has(id)),
    // Columns added after the user saved go at the end of their group.
    ...inScope.filter((id) => !savedById.has(id)),
  ];

  const inScopeState = ordered.map((colId): ColumnState => {
    const own = savedById.get(colId);
    const fallback = defaults.get(colId);
    const width = own?.width ?? fallback?.width;
    return { colId, hide: own ? own.hide : (fallback?.hide ?? false), ...(width ? { width } : {}) };
  });

  const outOfScopeState = defs
    .flatMap(leafIds)
    .filter((id) => !inScopeSet.has(id))
    .map((colId): ColumnState => ({ colId, hide: true }));

  return [...inScopeState, ...outOfScopeState];
}

/** What the grid shows for a view, as it would be saved: in-scope columns, in grid order. */
export function savedColumns(
  table: TableType,
  view: ViewState | undefined,
  state: readonly ColumnState[],
): SavedColumn[] {
  const inScope = new Set(columnIdsInScope(table, view));
  return state
    .filter((column) => inScope.has(column.colId))
    .map((column) => ({
      colId: column.colId,
      hide: !!column.hide,
      ...(column.width ? { width: column.width } : {}),
    }));
}

/** The columns tool panel lists only this view's clusters. */
export const toolPanelLayout = (table: TableType, view?: ViewState): Group[] => {
  const { clusters } = tableColumns(table);
  return clustersInScope(table, view).map((id) => clusters[id]);
};
