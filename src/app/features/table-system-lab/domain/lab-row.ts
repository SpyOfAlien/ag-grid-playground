import { RowIdentity } from '../../../shared/table-system/model/table-model';
export interface LabRow extends RowIdentity {
  readonly name: string;
  readonly amount: number | null;
  readonly reviewed: boolean;
  readonly category: 'parts' | 'labor' | 'other';
  readonly note: string;
  readonly locked: boolean;
}
export function validateRow(row: LabRow): void {
  if (!Number.isInteger(row.revision) || row.revision < 0) throw new Error('Invalid revision');
  if (row.amount !== null && !Number.isFinite(row.amount)) throw new Error('Invalid amount');
  if (!['parts', 'labor', 'other'].includes(row.category)) throw new Error('Invalid category');
}
export function fixtures(size = 1000): readonly LabRow[] {
  return Array.from({ length: size }, (_, i) => ({
    id: `item-${i}`,
    revision: 0,
    name: `Item ${i}`,
    amount: i === 1 ? null : i === 2 ? 12.345 : i * 1.25,
    reviewed: false,
    category: 'parts',
    note: i === 0 ? 'Check packaging' : '',
    locked: i === 3,
  }));
}
