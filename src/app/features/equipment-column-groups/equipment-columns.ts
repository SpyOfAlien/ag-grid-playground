import type { ColDef, ColGroupDef } from 'ag-grid-community';
import { RevisedCell, computePreviousValue } from './renderers/cells/revised-cell';
import { CollapsedGroupHeader } from './renderers/headers/collapsed-group-header';
import {
  GROUP_HEADER_CLASSES,
  GROUP_LEVEL_CLASSES,
  RAIL_CELL_CLASSES,
  RAIL_HEADER_CLASSES,
} from './equipment-group-classes';
import { EQUIPMENT_ROWS, type EquipmentGroupId, type EquipmentRow } from './equipment-data';

type EquipmentColumn = ColDef<EquipmentRow> | ColGroupDef<EquipmentRow>;

interface EquipmentGroup {
  id: EquipmentGroupId;
  label: string;
  children: (ColDef<EquipmentRow> | EquipmentGroup)[];
  open?: boolean;
}

/**
 * A column whose revised cells show the previous value above the current one.
 * Only changed cells get the Angular renderer; the rest stay plain text.
 */
function revisedColumn(
  colDef: ColDef<EquipmentRow>,
  previousField: keyof EquipmentRow & string,
): ColDef<EquipmentRow> {
  const hasPrevious = (data: EquipmentRow | undefined) =>
    computePreviousValue(data, previousField) != null;
  return {
    ...colDef,
    cellClassRules: { 'equipment-revised': ({ data }) => hasPrevious(data) },
    cellRendererSelector: ({ data }) =>
      hasPrevious(data) ? { component: RevisedCell, params: { previousField } } : undefined,
  };
}

/** Describes a column group; its colour level comes from how deeply it is nested. */
function group(options: EquipmentGroup): EquipmentGroup {
  return options;
}

function isGroup(item: ColDef<EquipmentRow> | EquipmentGroup): item is EquipmentGroup {
  return 'children' in item;
}

function buildColumns(
  items: (ColDef<EquipmentRow> | EquipmentGroup)[],
  level: number,
): EquipmentColumn[] {
  return items.map((item) => (isGroup(item) ? buildGroup(item, level) : item));
}

function buildGroup(
  { id, label, children, open = false }: EquipmentGroup,
  level: number,
): ColGroupDef<EquipmentRow> {
  // Groups deeper than the last defined level share its colours.
  const levelClasses = GROUP_LEVEL_CLASSES[Math.min(level, GROUP_LEVEL_CLASSES.length - 1)];
  return {
    groupId: id,
    headerName: label,
    openByDefault: open,
    marryChildren: true,
    headerClass: `${GROUP_HEADER_CLASSES} ${levelClasses}`,
    children: [
      // Rail: the fixed 38px placeholder column shown while the group is collapsed.
      {
        colId: `${id}-rail`,
        headerName: label,
        columnGroupShow: 'closed',
        width: 38,
        minWidth: 38,
        maxWidth: 38,
        resizable: false,
        sortable: false,
        filter: false,
        floatingFilter: false,
        suppressNavigable: true,
        headerClass: `${RAIL_HEADER_CLASSES} ${levelClasses}`,
        cellClass: `${RAIL_CELL_CLASSES} ${levelClasses}`,
        headerComponent: CollapsedGroupHeader,
        headerComponentParams: { changeCount: EQUIPMENT_ROWS.filter((row) => row.changed).length },
        valueGetter: () => '',
      },
      ...buildColumns(children, level + 1).map((child): EquipmentColumn => ({
        ...child,
        columnGroupShow: 'open',
      })),
    ],
  };
}

export function createEquipmentColumns(): EquipmentColumn[] {
  return buildColumns(
    [
      {
        field: 'id',
        headerName: 'No#',
        wrapHeaderText: false,
        headerClass: 'equipment-number-header',
        width: 48,
        minWidth: 48,
        filter: false,
        cellClass: 'equipment-row-number',
      },
      {
        field: 'revision',
        headerName: 'Revision',
        width: 110,
        cellClassRules: { 'equipment-revision-changed': ({ data }) => data?.changed ?? false },
      },
      { field: 'deviceType', headerName: 'Device Type', width: 140 },
      revisedColumn({ field: 'ward', headerName: 'Ward', width: 190 }, 'previousWard'),
      revisedColumn({ field: 'wardCode', headerName: 'Ward Code', width: 140 }, 'previousWardCode'),
      { field: 'room', headerName: 'Room', width: 140, cellClass: 'equipment-cell-muted' },
      { field: 'owner', headerName: 'Biomed Owner', width: 140, cellClass: 'equipment-cell-muted' },
      group({
        id: 'maintenance',
        label: 'Maintenance',
        children: [
          { field: 'workOrder', headerName: 'Work Order', width: 170 },
          { field: 'lastService', headerName: 'Last Service', width: 220 },
        ],
      }),
      group({
        id: 'clinical',
        label: 'Clinical Use',
        open: true,
        children: [
          group({
            id: 'usage',
            label: 'Usage',
            children: [
              { field: 'assetTag', headerName: 'Asset Tag', width: 200 },
              { field: 'usageHours', headerName: 'Usage Hours', width: 190 },
            ],
          }),
          group({
            id: 'alarms',
            label: 'Alarms',
            children: [
              { field: 'alarmProfile', headerName: 'Alarm Profile', width: 170 },
              { field: 'alarmVolume', headerName: 'Alarm Volume', width: 170 },
            ],
          }),
          group({
            id: 'location',
            label: 'Bedside Location',
            open: true,
            children: [
              { field: 'bed', headerName: 'Bed', width: 200 },
              { field: 'powerOutlet', headerName: 'Power Outlet', width: 200 },
            ],
          }),
        ],
      }),
      group({
        id: 'calibration',
        label: 'Calibration',
        children: [{ field: 'calibrationDue', headerName: 'Calibration Due', width: 200 }],
      }),
      group({
        id: 'safety',
        label: 'Electrical Safety',
        children: [{ field: 'safetyCheck', headerName: 'Safety Check', width: 180 }],
      }),
    ],
    0,
  );
}
