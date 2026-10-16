import type { ColDef, ColGroupDef } from 'ag-grid-community';
import { EquipmentChangeCell } from './equipment-change-cell';
import { EquipmentRailHeader } from './equipment-rail-header';
import { EQUIPMENT_ROWS, type EquipmentGroupId, type EquipmentRow } from './equipment-data';

type EquipmentColumn = ColDef<EquipmentRow> | ColGroupDef<EquipmentRow>;

/** Groups at this depth and deeper share the last level's colours. */
const MAX_GROUP_LEVEL = 3;

interface EquipmentGroup {
  id: EquipmentGroupId;
  label: string;
  children: (ColDef<EquipmentRow> | EquipmentGroup)[];
  open?: boolean;
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
  const levelClass = `equipment-level-${Math.min(level, MAX_GROUP_LEVEL)}`;
  return {
    groupId: id,
    headerName: label,
    openByDefault: open,
    marryChildren: true,
    headerClass: `equipment-group ${levelClass}`,
    children: [
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
        headerClass: `equipment-rail ${levelClass}`,
        cellClass: `equipment-rail-cell ${levelClass}`,
        headerComponent: EquipmentRailHeader,
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
      {
        field: 'ward',
        headerName: 'Ward',
        width: 190,
        cellRenderer: EquipmentChangeCell,
        cellClassRules: { 'equipment-changed': ({ data }) => data?.previousWard != null },
      },
      {
        field: 'wardCode',
        headerName: 'Ward Code',
        width: 140,
        cellRenderer: EquipmentChangeCell,
        cellClassRules: { 'equipment-changed': ({ data }) => data?.previousWardCode != null },
      },
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
