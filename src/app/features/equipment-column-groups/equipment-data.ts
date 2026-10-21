/** One medical device in the ICU equipment register. */
export interface EquipmentRow {
  id: number;
  revision: string;
  deviceType: string;
  ward: string;
  wardCode: string;
  room: string;
  owner: string;
  workOrder: string;
  lastService: string;
  assetTag: string;
  usageHours: string;
  alarmProfile: string;
  alarmVolume: string;
  bed: string;
  powerOutlet: string;
  calibrationDue: string;
  safetyCheck: string;
  serialNumber: string;
  manufacturer: string;
  model: string;
  firmware: string;
  voltage: string;
  batteryLife: string;
  vendor: string;
  purchaseDate: string;
  cost: string;
  warrantyEnd: string;
  warrantyProvider: string;
  ipAddress: string;
  macAddress: string;
  lastSync: string;
  certification: string;
  auditDate: string;
  changed: boolean;
  previousWard: string | null;
  previousWardCode: string | null;
}

const pad = (value: number): string => String(value).padStart(3, '0');

export const EQUIPMENT_ROWS: EquipmentRow[] = Array.from({ length: 24 }, (_, index) => ({
  id: index + 1,
  revision: 'R2',
  deviceType: index < 16 ? 'Ventilator' : 'Infusion Pump',
  ward: index < 16 ? 'ICU North' : 'ICU South',
  wardCode: index < 16 ? 'ICU-N' : 'ICU-S',
  room: index < 16 ? `N-${101 + (index % 8)}` : `S-${201 + (index % 8)}`,
  owner: 'Biomed Team A',
  workOrder: `WO-${pad(index + 1)}`,
  lastService: index % 2 === 0 ? 'Filter replaced' : 'Battery check',
  assetTag: `ICU-EQ-${pad(index + 1)}`,
  usageHours: `${1200 + index * 37} h`,
  alarmProfile: index % 2 === 0 ? 'Adult' : 'Paediatric',
  alarmVolume: index % 3 === 0 ? 'High' : 'Medium',
  bed: index < 16 ? `Bed ${(index % 8) + 1}` : `Bed ${(index % 8) + 9}`,
  powerOutlet: index % 2 === 0 ? 'UPS-A' : 'UPS-B',
  calibrationDue: `2026-${String((index % 12) + 1).padStart(2, '0')}-15`,
  safetyCheck: index % 2 === 0 ? 'Passed' : 'Due',
  serialNumber: `SN-${pad(4100 + index)}`,
  manufacturer: index < 16 ? 'Hamilton Medical' : 'B. Braun',
  model: index < 16 ? 'C6' : 'Infusomat Space',
  firmware: `v${3 + (index % 3)}.${index % 10}`,
  voltage: index % 2 === 0 ? '230 V' : '110 V',
  batteryLife: `${2 + (index % 4)} h`,
  vendor: index % 3 === 0 ? 'MedSupply Co.' : 'HealthTech Ltd.',
  purchaseDate: `2023-${String((index % 12) + 1).padStart(2, '0')}-01`,
  cost: `$${(18000 + index * 250).toLocaleString('en-US')}`,
  warrantyEnd: `2027-${String((index % 12) + 1).padStart(2, '0')}-01`,
  warrantyProvider: index % 2 === 0 ? 'Manufacturer' : 'Third party',
  ipAddress: `10.20.${index < 16 ? 1 : 2}.${10 + index}`,
  macAddress: `00:1B:44:11:3A:${String(index).padStart(2, '0')}`,
  lastSync: `2026-10-${String((index % 28) + 1).padStart(2, '0')} 08:00`,
  certification: index % 4 === 0 ? 'IEC 60601-1' : 'ISO 13485',
  auditDate: `2026-${String((index % 12) + 1).padStart(2, '0')}-20`,
  changed: index < 6,
  previousWard: index >= 2 && index < 6 ? 'Step-down Unit' : null,
  previousWardCode: index < 2 ? 'SDU' : null,
}));

export const EQUIPMENT_GROUPS = [
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'clinical', label: 'Clinical Use' },
  { id: 'usage', label: 'Usage' },
  { id: 'alarms', label: 'Alarms' },
  { id: 'location', label: 'Bedside Location' },
  { id: 'calibration', label: 'Calibration' },
  { id: 'safety', label: 'Electrical Safety' },
] as const;

export type EquipmentGroupId = (typeof EQUIPMENT_GROUPS)[number]['id'];

/** Column group as the backend sends it; nesting comes from parentCode. */
export interface EquipmentGroupDto {
  code: string;
  name: string;
  parentCode: string | null;
  /** Position among the group's siblings, columns and groups alike. */
  orderNo: number;
  open?: boolean;
}

/** Leaf column as the backend sends it; groupCode is null for ungrouped columns. */
export interface EquipmentColumnDto {
  code: string;
  name: string;
  groupCode: string | null;
  /** Position among the column's siblings, columns and groups alike. */
  orderNo: number;
  width?: number;
  muted?: boolean;
  /** Row field with the value before the change; revised cells show it above the current one. */
  previousCode?: string;
}

/** Stand-in for the column structure endpoint. Order comes from orderNo, not list position. */
export const EQUIPMENT_COLUMN_PAYLOAD: {
  groups: EquipmentGroupDto[];
  columns: EquipmentColumnDto[];
} = {
  groups: [
    { code: 'maintenance', name: 'Maintenance', parentCode: null, orderNo: 5 },
    { code: 'clinical', name: 'Clinical Use', parentCode: null, orderNo: 6, open: true },
    { code: 'usage', name: 'Usage', parentCode: 'clinical', orderNo: 0 },
    { code: 'alarms', name: 'Alarms', parentCode: 'clinical', orderNo: 1 },
    { code: 'location', name: 'Bedside Location', parentCode: 'clinical', orderNo: 2, open: true },
    { code: 'calibration', name: 'Calibration', parentCode: null, orderNo: 7 },
    { code: 'safety', name: 'Electrical Safety', parentCode: null, orderNo: 8 },
    // Three levels deep, so the deepest group uses the last colour level.
    { code: 'specs', name: 'Technical Specs', parentCode: null, orderNo: 10 },
    { code: 'hardware', name: 'Hardware', parentCode: 'specs', orderNo: 2 },
    { code: 'power', name: 'Power', parentCode: 'hardware', orderNo: 1 },
    // Open by default, with a collapsed group nested after its own columns.
    { code: 'procurement', name: 'Procurement', parentCode: null, orderNo: 11, open: true },
    { code: 'warranty', name: 'Warranty', parentCode: 'procurement', orderNo: 3 },
    { code: 'network', name: 'Network', parentCode: null, orderNo: 12 },
    // Long name, to see it cut off with "…" on the rail.
    {
      code: 'compliance',
      name: 'Regulatory Compliance & Certification',
      parentCode: null,
      orderNo: 13,
    },
    // No columns, so it is left out of the grid.
    { code: 'archived', name: 'Archived', parentCode: null, orderNo: 14 },
  ],
  columns: [
    { code: 'deviceType', name: 'Device Type', groupCode: null, orderNo: 0, width: 140 },
    {
      code: 'ward',
      name: 'Ward',
      groupCode: null,
      orderNo: 1,
      width: 190,
      previousCode: 'previousWard',
    },
    {
      code: 'wardCode',
      name: 'Ward Code',
      groupCode: null,
      orderNo: 2,
      width: 140,
      previousCode: 'previousWardCode',
    },
    { code: 'room', name: 'Room', groupCode: null, orderNo: 3, width: 140, muted: true },
    { code: 'owner', name: 'Biomed Owner', groupCode: null, orderNo: 4, width: 140, muted: true },
    { code: 'workOrder', name: 'Work Order', groupCode: 'maintenance', orderNo: 0, width: 170 },
    { code: 'lastService', name: 'Last Service', groupCode: 'maintenance', orderNo: 1, width: 220 },
    { code: 'assetTag', name: 'Asset Tag', groupCode: 'usage', orderNo: 0, width: 200 },
    { code: 'usageHours', name: 'Usage Hours', groupCode: 'usage', orderNo: 1, width: 190 },
    { code: 'alarmProfile', name: 'Alarm Profile', groupCode: 'alarms', orderNo: 0, width: 170 },
    { code: 'alarmVolume', name: 'Alarm Volume', groupCode: 'alarms', orderNo: 1, width: 170 },
    { code: 'bed', name: 'Bed', groupCode: 'location', orderNo: 0, width: 200 },
    { code: 'powerOutlet', name: 'Power Outlet', groupCode: 'location', orderNo: 1, width: 200 },
    {
      code: 'calibrationDue',
      name: 'Calibration Due',
      groupCode: 'calibration',
      orderNo: 0,
      width: 200,
    },
    { code: 'safetyCheck', name: 'Safety Check', groupCode: 'safety', orderNo: 0, width: 180 },
    // Ungrouped column between groups.
    { code: 'serialNumber', name: 'Serial Number', groupCode: null, orderNo: 9, width: 150 },
    { code: 'manufacturer', name: 'Manufacturer', groupCode: 'specs', orderNo: 0, width: 170 },
    { code: 'model', name: 'Model', groupCode: 'specs', orderNo: 1, width: 160 },
    { code: 'firmware', name: 'Firmware', groupCode: 'hardware', orderNo: 0, width: 120 },
    { code: 'voltage', name: 'Voltage', groupCode: 'power', orderNo: 0, width: 120 },
    { code: 'batteryLife', name: 'Battery Life', groupCode: 'power', orderNo: 1, width: 130 },
    { code: 'vendor', name: 'Vendor', groupCode: 'procurement', orderNo: 0, width: 170 },
    {
      code: 'purchaseDate',
      name: 'Purchase Date',
      groupCode: 'procurement',
      orderNo: 1,
      width: 150,
    },
    { code: 'cost', name: 'Cost', groupCode: 'procurement', orderNo: 2, width: 120 },
    { code: 'warrantyEnd', name: 'Warranty End', groupCode: 'warranty', orderNo: 0, width: 150 },
    {
      code: 'warrantyProvider',
      name: 'Provider',
      groupCode: 'warranty',
      orderNo: 1,
      width: 150,
    },
    { code: 'ipAddress', name: 'IP Address', groupCode: 'network', orderNo: 0, width: 140 },
    { code: 'macAddress', name: 'MAC Address', groupCode: 'network', orderNo: 1, width: 180 },
    { code: 'lastSync', name: 'Last Sync', groupCode: 'network', orderNo: 2, width: 170 },
    {
      code: 'certification',
      name: 'Certification',
      groupCode: 'compliance',
      orderNo: 0,
      width: 160,
    },
    { code: 'auditDate', name: 'Audit Date', groupCode: 'compliance', orderNo: 1, width: 140 },
  ],
};
