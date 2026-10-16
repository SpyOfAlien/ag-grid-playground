import { DemoRow } from './demo-row.model';

export const DEMO_COLUMN_COUNT = 200;
export const METRIC_COLUMN_COUNT = DEMO_COLUMN_COUNT - 3;
export const DEFAULT_ROW_COUNT = 1_000;
export const MAX_ROW_COUNT = 10_000;

/** The same row count and revision produce the same values. */
export function createDemoRows(count: number, revision = 0): DemoRow[] {
  if (!Number.isSafeInteger(count) || count < 1 || count > MAX_ROW_COUNT) {
    throw new RangeError(`Row count must be an integer between 1 and ${MAX_ROW_COUNT}.`);
  }
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new RangeError('Fixture revision must be a non-negative integer.');
  }
  return Array.from({ length: count }, (_, index) => ({
    id: `row-${String(index + 1).padStart(5, '0')}`,
    name: `Material ${String(index + 1).padStart(5, '0')}`,
    metrics: Array.from({ length: METRIC_COLUMN_COUNT }, (_, column) =>
      column > 0 && (index + column) % 29 === 0
        ? null
        : ((index * 97 + column * 131 + revision * 10_003) % 1_000_000) / 100,
    ),
    metadata: { reviewed: index % 3 === 0, revision: 0, unit: index % 2 === 0 ? 'kg' : 't' },
  }));
}

/** Replace values with stable IDs, preserving existing metadata. */
export function replaceDemoRows(rows: readonly DemoRow[], revision: number): DemoRow[] {
  const metadata = new Map(rows.map((row) => [row.id, row.metadata]));
  return createDemoRows(rows.length, revision).map((row) => ({
    ...row,
    metadata: metadata.get(row.id) ?? row.metadata,
  }));
}

/** The exact metrics arrays survive a metadata-only update. */
export function toggleDemoMetadata(rows: readonly DemoRow[]): DemoRow[] {
  return rows.map((row) => ({
    ...row,
    metadata: {
      reviewed: !row.metadata.reviewed,
      revision: row.metadata.revision + 1,
      unit: row.metadata.unit === 'kg' ? 't' : 'kg',
    },
  }));
}
