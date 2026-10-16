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
