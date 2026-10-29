import type { ColDef, ColGroupDef } from 'ag-grid-community';
import { buildSignalStructureTree } from '../signal-structure-tree';
import type { SignalColumn, SignalGroup, SignalRow, SignalStructureNode } from '../signal.model';
import { FilterRowCell, type FilterRowCellParams } from '../renderers/filter-row-cell';
import { RailLabelHeader } from '../rail-label-header';
import { ColumnHeaderLabel } from '../edit/column-header-label';

export const ROW_NO_COL_ID = '__rowNo';
export const REVISION_COL_ID = '__revision';
export const RAIL_COL_ID = '__rail';

export const isRailColId = (colId: string): boolean => colId.endsWith(RAIL_COL_ID);

/** Width of a collapsed group's rail. */
export const RAIL_WIDTH = 48;

type SignalColDef = ColDef<SignalRow> | ColGroupDef<SignalRow>;

export interface SignalColumnDefOptions {
  changeCountFor?: (groupCode: string) => number;
  /** The values offered by a select filter (columns with selectFilter). */
  selectOptionsFor?: (columnCode: string) => readonly string[];
}

export function buildSignalColumnDefs(
  groups: SignalGroup[],
  columns: SignalColumn[],
  options: SignalColumnDefOptions = {},
): SignalColDef[] {
  return [
    rowNoColDef(),
    revisionColDef(),
    ...toColDefs(buildSignalStructureTree(groups, columns), options),
  ];
}

function toColDefs(nodes: SignalStructureNode[], options: SignalColumnDefOptions): SignalColDef[] {
  return nodes.flatMap((node): SignalColDef[] => {
    if (node.kind === 'column') {
      return [toLeafColDef(node.column, options)];
    }
    const children = toColDefs(node.children, options);
    return children.length > 0 ? [toGroupColDef(node.group, node.depth, children, options)] : [];
  });
}

/** The outermost groups are dark; every level below shares the light colours. */
const levelClass = (depth: number) => (depth === 0 ? 'signal-level-outer' : 'signal-level-inner');

function toGroupColDef(
  group: SignalGroup,
  depth: number,
  children: SignalColDef[],
  options: SignalColumnDefOptions,
): ColGroupDef<SignalRow> {
  const level = levelClass(depth);
  return {
    groupId: group.code,
    headerName: group.name,
    headerClass: `signal-group ${level}`,
    openByDefault: true,
    marryChildren: true,
    // The rail stands in for the whole group while collapsed, so every real child is 'open'.
    children: [
      railColDef(group, level, options),
      ...children.map((child) => ({ ...child, columnGroupShow: 'open' as const })),
    ],
  };
}

function toLeafColDef(
  column: SignalColumn,
  { selectOptionsFor }: SignalColumnDefOptions,
): ColDef<SignalRow> {
  const filterParams: Pick<FilterRowCellParams, 'kind' | 'options'> = column.selectFilter
    ? { kind: 'select', options: selectOptionsFor?.(column.code) ?? [] }
    : { kind: column.groupCode ? 'search-sort' : 'search-filter' };
  return {
    colId: column.code,
    headerName: column.name,
    field: `data.${column.code}` as ColDef<SignalRow>['field'],
    filter: 'agTextColumnFilter',
    floatingFilterComponent: FilterRowCell,
    floatingFilterComponentParams: filterParams,
    suppressFloatingFilterButton: true,
    // The name, with the edit-mode checkbox; AG Grid keeps its own header icons around it.
    headerComponentParams: { innerHeaderComponent: ColumnHeaderLabel },
  };
}

/**
 * The column shown in place of a collapsed group. Its header (RailLabelHeader) draws the badge,
 * the rail and the group's name, from the header down to the bottom of the table; the body cells
 * are plain rail colour under it.
 */
function railColDef(
  group: SignalGroup,
  level: string,
  { changeCountFor }: SignalColumnDefOptions,
): ColDef<SignalRow> {
  return {
    colId: `${group.code}${RAIL_COL_ID}`,
    headerName: group.name,
    columnGroupShow: 'closed',
    width: RAIL_WIDTH,
    minWidth: RAIL_WIDTH,
    maxWidth: RAIL_WIDTH,
    // Opt out of the default flex, which would otherwise only be held back by maxWidth.
    flex: 0,
    resizable: false,
    sortable: false,
    filter: false,
    floatingFilter: false,
    suppressNavigable: true,
    suppressMovable: true,
    wrapHeaderText: false,
    // The header fills its cell, so measuring it for auto height would grow the row forever.
    autoHeaderHeight: false,
    headerClass: `signal-rail ${level}`,
    cellClass: `signal-rail-cell ${level}`,
    headerComponent: RailLabelHeader,
    headerComponentParams: { changeCount: changeCountFor?.(group.code) ?? 0 },
    valueGetter: () => '',
  };
}

function rowNoColDef(): ColDef<SignalRow> {
  return {
    colId: ROW_NO_COL_ID,
    headerName: 'No#',
    valueGetter: ({ node }) => (node?.rowIndex ?? 0) + 1,
    pinned: 'left',
    lockPinned: true,
    width: 48,
    minWidth: 48,
    flex: 0,
    resizable: false,
    filter: false,
    suppressMovable: true,
    cellClass: 'cell-row-index',
  };
}

function revisionColDef(): ColDef<SignalRow> {
  return {
    colId: REVISION_COL_ID,
    headerName: 'Revision',
    valueGetter: ({ data }) => data?.revisionLabel ?? '-',
    width: 110,
    flex: 0,
    filter: 'agTextColumnFilter',
    floatingFilterComponent: FilterRowCell,
    floatingFilterComponentParams: { kind: 'search-filter' } satisfies Pick<
      FilterRowCellParams,
      'kind'
    >,
    suppressFloatingFilterButton: true,
    suppressMovable: true,
  };
}
