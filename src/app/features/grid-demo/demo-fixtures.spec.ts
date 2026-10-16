import { DEMO_COLUMNS } from './demo-columns';
import {
  createDemoRows,
  METRIC_COLUMN_COUNT,
  replaceDemoRows,
  toggleDemoMetadata,
} from './demo-fixtures';

describe('demo fixtures', () => {
  it('creates deterministic values, unique stable identities, and ten showcase columns', () => {
    const rows = createDemoRows(100);
    expect(rows).toEqual(createDemoRows(100));
    expect(new Set(rows.map((row) => row.id)).size).toBe(100);
    expect(DEMO_COLUMNS).toHaveLength(10);
    expect(rows.every((row) => row.metrics.length === METRIC_COLUMN_COUNT)).toBe(true);
    expect(rows[0].metrics[0]).toBe(0);
    expect(rows.some((row) => row.metrics.includes(null))).toBe(true);
  });

  it('changes metadata without changing numeric data or mutating the originals', () => {
    const rows = createDemoRows(10);
    const changed = toggleDemoMetadata(rows);
    for (const [index, row] of changed.entries()) {
      expect(row.id).toBe(rows[index].id);
      expect(row.metrics).toBe(rows[index].metrics);
      expect(row.metadata.reviewed).toBe(!rows[index].metadata.reviewed);
      expect(row.metadata.revision).toBe(1);
      expect(rows[index].metadata.revision).toBe(0);
    }
  });

  it('replaces numeric values while retaining identities and independently changed metadata', () => {
    const rows = toggleDemoMetadata(createDemoRows(10));
    const replaced = replaceDemoRows(rows, 1);
    expect(replaced.map((row) => row.id)).toEqual(rows.map((row) => row.id));
    expect(replaced[0].metrics[0]).not.toBe(rows[0].metrics[0]);
    expect(replaced[0].metadata).toBe(rows[0].metadata);
    expect(rows[0].metrics[0]).toBe(0);
  });

  it.each([0, -1, 1.5, 10_001, NaN, Infinity])('rejects unsupported row count %s', (count) => {
    expect(() => createDemoRows(count)).toThrow(RangeError);
  });
});
