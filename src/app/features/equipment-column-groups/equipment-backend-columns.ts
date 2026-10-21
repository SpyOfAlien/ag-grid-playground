import type { ColDef, ColGroupDef } from 'ag-grid-community';
import { RevisedCell, computePreviousValue } from './renderers/cells/revised-cell';
import { CollapsedGroupHeader } from './renderers/headers/collapsed-group-header';
import {
  GROUP_HEADER_CLASSES,
  GROUP_LEVEL_CLASSES,
  RAIL_CELL_CLASSES,
  RAIL_HEADER_CLASSES,
} from './equipment-group-classes';
import type { EquipmentColumnDto, EquipmentGroupDto, EquipmentRow } from './equipment-data';

type EquipmentColDef = ColDef<EquipmentRow> | ColGroupDef<EquipmentRow>;
type RowField = keyof EquipmentRow & string;

interface ColumnNode {
  kind: 'column';
  column: EquipmentColumnDto;
}

interface GroupNode {
  kind: 'group';
  group: EquipmentGroupDto;
  depth: number;
  children: StructureNode[];
}

type StructureNode = ColumnNode | GroupNode;

export interface EquipmentColumnDefOptions {
  /** Number shown in the badge on a collapsed group's rail. */
  changeCountFor?: (groupCode: string) => number;
}

/**
 * Builds the grid columns from the flat group and column lists the backend sends.
 * Every group gets a rail: the 38px column shown in its place while it is collapsed.
 */
export function buildEquipmentColumnDefs(
  groups: EquipmentGroupDto[],
  columns: EquipmentColumnDto[],
  options: EquipmentColumnDefOptions = {},
): EquipmentColDef[] {
  return [
    rowNoColDef(),
    revisionColDef(),
    ...toColDefs(buildStructureTree(groups, columns), options),
  ];
}

interface TreeEntry {
  orderNo: number;
  toNode: (depth: number) => StructureNode;
}

/**
 * Nests columns under their groups and groups under their parents, sorting siblings by
 * orderNo. An unknown groupCode or parentCode puts the item at the top level.
 * Follows buildSignalStructureTree in the signal project.
 */
function buildStructureTree(
  groups: EquipmentGroupDto[],
  columns: EquipmentColumnDto[],
): StructureNode[] {
  const groupCodes = new Set(groups.map((group) => group.code));
  const entriesByParent = new Map<string | null, TreeEntry[]>();
  const add = (parentCode: string | null, entry: TreeEntry) => {
    const key = parentCode && groupCodes.has(parentCode) ? parentCode : null;
    entriesByParent.set(key, [...(entriesByParent.get(key) ?? []), entry]);
  };

  function childrenOf(parentCode: string | null, depth: number): StructureNode[] {
    return [...(entriesByParent.get(parentCode) ?? [])]
      .sort((a, b) => a.orderNo - b.orderNo)
      .map((entry) => entry.toNode(depth));
  }

  for (const column of columns) {
    add(column.groupCode, { orderNo: column.orderNo, toNode: () => ({ kind: 'column', column }) });
  }

  for (const group of groups) {
    add(group.parentCode, {
      orderNo: group.orderNo,
      toNode: (depth) => ({
        kind: 'group',
        group,
        depth,
        children: childrenOf(group.code, depth + 1),
      }),
    });
  }

  return childrenOf(null, 0);
}

/** Groups without columns are left out. */
function toColDefs(nodes: StructureNode[], options: EquipmentColumnDefOptions): EquipmentColDef[] {
  return nodes.flatMap((node): EquipmentColDef[] => {
    if (node.kind === 'column') {
      return [toLeafColDef(node.column)];
    }
    const children = toColDefs(node.children, options);
    return children.length > 0 ? [toGroupColDef(node.group, node.depth, children, options)] : [];
  });
}

function toGroupColDef(
  group: EquipmentGroupDto,
  depth: number,
  children: EquipmentColDef[],
  options: EquipmentColumnDefOptions,
): ColGroupDef<EquipmentRow> {
  // Groups deeper than the last defined level share its colours.
  const levelClasses = GROUP_LEVEL_CLASSES[Math.min(depth, GROUP_LEVEL_CLASSES.length - 1)];
  return {
    groupId: group.code,
    headerName: group.name,
    openByDefault: group.open ?? false,
    marryChildren: true,
    headerClass: `${GROUP_HEADER_CLASSES} ${levelClasses}`,
    // The rail stands in for the whole group while collapsed, so every real child is 'open'.
    children: [
      railColDef(group, levelClasses, options.changeCountFor?.(group.code) ?? 0),
      ...children.map((child) => ({ ...child, columnGroupShow: 'open' as const })),
    ],
  };
}

function railColDef(
  group: EquipmentGroupDto,
  levelClasses: string,
  changeCount: number,
): ColDef<EquipmentRow> {
  return {
    colId: `${group.code}-rail`,
    headerName: group.name,
    columnGroupShow: 'closed',
    width: 38,
    minWidth: 38,
    maxWidth: 38,
    resizable: false,
    sortable: false,
    filter: false,
    floatingFilter: false,
    suppressNavigable: true,
    // The header fills its cell, so measuring it for auto height would grow the row forever.
    autoHeaderHeight: false,
    wrapHeaderText: false,
    headerClass: `${RAIL_HEADER_CLASSES} ${levelClasses}`,
    cellClass: `${RAIL_CELL_CLASSES} ${levelClasses}`,
    headerComponent: CollapsedGroupHeader,
    headerComponentParams: { changeCount },
    valueGetter: () => '',
  };
}

function toLeafColDef(column: EquipmentColumnDto): ColDef<EquipmentRow> {
  const def: ColDef<EquipmentRow> = {
    colId: column.code,
    field: column.code as RowField,
    headerName: column.name,
    width: column.width,
  };
  if (column.muted) {
    def.cellClass = 'equipment-cell-muted';
  }
  if (column.previousCode) {
    const previousField = column.previousCode as RowField;
    const hasPrevious = (data: EquipmentRow | undefined) =>
      computePreviousValue(data, previousField) != null;
    // Only changed cells get the Angular renderer; the rest stay plain text.
    def.cellClassRules = { 'equipment-revised': ({ data }) => hasPrevious(data) };
    def.cellRendererSelector = ({ data }) =>
      hasPrevious(data) ? { component: RevisedCell, params: { previousField } } : undefined;
  }
  return def;
}

function rowNoColDef(): ColDef<EquipmentRow> {
  return {
    field: 'id',
    headerName: 'No#',
    pinned: 'left',
    lockPinned: true,
    wrapHeaderText: false,
    headerClass: 'equipment-number-header',
    width: 48,
    minWidth: 48,
    filter: false,
    cellClass: 'equipment-row-number',
  };
}

function revisionColDef(): ColDef<EquipmentRow> {
  return {
    field: 'revision',
    headerName: 'Revision',
    width: 110,
    cellClassRules: { 'equipment-revision-changed': ({ data }) => data?.changed ?? false },
  };
}
