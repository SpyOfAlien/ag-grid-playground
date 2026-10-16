import { createDemoRows } from '../demo-fixtures';
import { normalizeDemoResponse, readDemoResponse } from './demo-api.model';

describe('Demo dataset responses', () => {
  const rows = createDemoRows(2);
  const row = rows[0];
  it('normalizes values and recalculates dependent rows', () => {
    const result = readDemoResponse(
      normalizeDemoResponse(
        {
          row,
          columnId: 'name',
          changes: {
            name: ' Draft ',
            metrics: row.metrics.map((value, index) => (index === 2 ? 12.345 : value)),
          },
        },
        false,
        rows,
      ),
    );
    expect(result.rows[0].name).toBe('Draft');
    expect(result.rows[0].metrics[2]).toBe(12.35);
    expect(result.rows[1].metrics.at(-1)).toBe(12.35);
  });
  it('accepts responses that delete the origin, including an empty dataset', () => {
    expect(readDemoResponse({ update: { kind: 'replace-rows', rows: [rows[1]] } })).toEqual({
      kind: 'replace-rows',
      rows: [rows[1]],
    });
    expect(readDemoResponse({ update: { kind: 'replace-rows', rows: [] } })).toEqual({
      kind: 'replace-rows',
      rows: [],
    });
  });
  it('rejects malformed rows, duplicate identities, and patch responses', () => {
    expect(() =>
      readDemoResponse({ update: { kind: 'replace-rows', rows: [{ ...row, metrics: ['bad'] }] } }),
    ).toThrow('Invalid server response');
    expect(() => readDemoResponse({ update: { kind: 'upsert-rows', rows: [row, row] } })).toThrow(
      'Invalid server row identities',
    );
    expect(() =>
      readDemoResponse({ update: { kind: 'patch-row', rowId: row.id, changes: {} } }),
    ).toThrow('Invalid server response');
  });
});
