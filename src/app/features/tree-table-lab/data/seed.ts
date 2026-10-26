import type { RowData } from '../tree-table.model';

export type SeedRow = Pick<RowData, 'path' | 'partCode'> & Partial<Omit<RowData, 'id' | 'parent'>>;

const DEFAULTS: Omit<RowData, 'id' | 'path' | 'parent' | 'partCode' | 'partName' | 'level'> = {
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
  edited: [],
};

/** Fills every field, takes the id and name from the path and marks rows that have children. */
export function buildRows(seed: readonly SeedRow[]): RowData[] {
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
