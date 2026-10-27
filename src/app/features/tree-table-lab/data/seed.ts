import type { RowRecord, TableRecords } from '../tree-table.model';

export type SeedRow = Pick<RowRecord, 'path' | 'partCode'> &
  Partial<Omit<RowRecord, 'id' | 'parent'>>;

const DEFAULTS: Omit<RowRecord, 'id' | 'path' | 'parent' | 'partCode' | 'partName' | 'level'> = {
  unit: 'pcs',
  quantity: 0,
  shippedQuantity: 0,
  shipmentStatus: 'open',
  transportMode: 'Road',
  freightRate: 0,
  transitDays: 0,
  carrier: '',
  emptyReturnDays: 0,
  emptyReturnCost: 0,
  packSize: 0,
  packWeight: 0,
  packDimensions: '',
  packConcept: '',
  packType: '',
  stockOnHand: 0,
  dailyUsage: 0,
  safetyStock: 0,
  unitCost: 0,
  capitalRate: 0,
  replenishmentDays: 0,
  emptiesTracked: false,
  packNotes: '',
  autoReorder: false,
};

/** Fills every field, takes the id and name from the path and marks rows that have children. */
export function buildRows(seed: readonly SeedRow[]): RowRecord[] {
  const key = (path: readonly string[]) => path.join('/');
  const parents = new Set(
    seed.filter((row) => row.path.length > 1).map((row) => key(row.path.slice(0, -1))),
  );
  return seed.map((row) => ({
    ...DEFAULTS,
    partName: row.path.at(-1)!,
    level: row.path.length - 1,
    ...row,
    id: key(row.path),
    parent: parents.has(key(row.path)),
  }));
}

/**
 * The records a table loads, as the backend sends them: the active rows, and each row as it was
 * created. `editedSince` holds, per row id, the values users have changed since; the original
 * puts them back.
 */
export function tableRecords(
  active: readonly RowRecord[],
  editedSince: Readonly<Record<string, Partial<RowRecord>>> = {},
): TableRecords {
  return { active, original: active.map((row) => ({ ...row, ...editedSince[row.id] })) };
}
