import type { DemoRow } from '../demo-row.model';
export type DemoDatasetUpdate =
  | { readonly kind: 'replace-rows'; readonly rows: readonly DemoRow[] }
  | { readonly kind: 'upsert-rows'; readonly rows: readonly DemoRow[] };

export interface DemoFieldsPayload {
  readonly row: Readonly<DemoRow>;
  readonly columnId: string;
  readonly changes: Partial<DemoRow>;
}
export interface DemoDetailsPayload {
  readonly row: Readonly<DemoRow>;
  readonly details: {
    readonly name: string;
    readonly amount: number | null;
    readonly notes: string;
  };
}
export type DemoPayload = DemoFieldsPayload | DemoDetailsPayload;
export interface DemoResponse {
  readonly update: DemoDatasetUpdate;
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function metadata(value: unknown): value is DemoRow['metadata'] {
  return (
    record(value) &&
    typeof value['reviewed'] === 'boolean' &&
    typeof value['revision'] === 'number' &&
    Number.isSafeInteger(value['revision']) &&
    value['revision'] >= 0 &&
    (value['unit'] === 'kg' || value['unit'] === 't')
  );
}
function metrics(value: unknown): value is DemoRow['metrics'] {
  return (
    Array.isArray(value) &&
    value.every(
      (item: unknown) => item === null || (typeof item === 'number' && Number.isFinite(item)),
    )
  );
}
export function isDemoPatch(value: unknown): value is Partial<DemoRow> {
  if (
    !record(value) ||
    !Object.keys(value).every((key) => ['id', 'name', 'notes', 'metrics', 'metadata'].includes(key))
  )
    return false;
  return (
    (value['id'] === undefined || typeof value['id'] === 'string') &&
    (value['name'] === undefined || typeof value['name'] === 'string') &&
    (value['notes'] === undefined || typeof value['notes'] === 'string') &&
    (value['metrics'] === undefined || metrics(value['metrics'])) &&
    (value['metadata'] === undefined || metadata(value['metadata']))
  );
}
export function isDemoRow(value: unknown): value is DemoRow {
  return (
    isDemoPatch(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    metrics(value.metrics) &&
    metadata(value.metadata)
  );
}
export function isDemoPayload(value: unknown): value is DemoPayload {
  if (!record(value) || !isDemoRow(value['row'])) return false;
  if ('changes' in value)
    return typeof value['columnId'] === 'string' && isDemoPatch(value['changes']);
  const details = value['details'];
  return (
    record(details) &&
    typeof details['name'] === 'string' &&
    typeof details['notes'] === 'string' &&
    (details['amount'] === null ||
      (typeof details['amount'] === 'number' && Number.isFinite(details['amount'])))
  );
}
export function readDemoResponse(value: unknown): DemoDatasetUpdate {
  if (!record(value) || !record(value['update'])) throw new Error('Invalid server response.');
  const update = value['update'];
  if (
    (update['kind'] === 'replace-rows' || update['kind'] === 'upsert-rows') &&
    Array.isArray(update['rows']) &&
    update['rows'].every(isDemoRow)
  ) {
    const rows: DemoRow[] = update['rows'];
    if (rows.some((row) => !row.id) || new Set(rows.map((row) => row.id)).size !== rows.length)
      throw new Error('Invalid server row identities.');
    return { kind: update['kind'], rows };
  }
  throw new Error('Invalid server response.');
}
export function normalizeDemoResponse(
  payload: DemoPayload,
  approve: boolean,
  dataset: readonly DemoRow[] = [payload.row],
): DemoResponse {
  const row = payload.row;
  const proposed: Partial<DemoRow> =
    'changes' in payload
      ? payload.changes
      : {
          name: payload.details.name,
          notes: payload.details.notes,
          metrics: row.metrics.map((value, index) =>
            index === 2 ? payload.details.amount : value,
          ),
        };
  const changes: Partial<DemoRow> = {
    ...proposed,
    ...(proposed.name !== undefined ? { name: proposed.name.trim() } : {}),
    ...(proposed.notes !== undefined ? { notes: proposed.notes.trim() } : {}),
    ...(proposed.metrics !== undefined
      ? {
          metrics: proposed.metrics.map((value) =>
            value === null ? null : Math.round(value * 100) / 100,
          ),
        }
      : {}),
    metadata: {
      ...row.metadata,
      ...proposed.metadata,
      reviewed: approve || (proposed.metadata?.reviewed ?? row.metadata.reviewed),
      unit: approve ? 't' : (proposed.metadata?.unit ?? row.metadata.unit),
      revision: row.metadata.revision + 1,
    },
  };
  // The fixture recalculates the adjacent row's final metric as a dependent value.
  const origin = dataset.findIndex((item) => item.id === row.id);
  const dependent = origin < 0 ? -1 : (origin + 1) % dataset.length;
  const rows = dataset.map((item, index) => {
    if (item.id === row.id) return { ...row, ...changes };
    if (index !== dependent) return item;
    const sourceMetric = 'columnId' in payload && payload.columnId === 'toggle-number' ? 7 : 2;
    const source = (changes.metrics ?? row.metrics)[sourceMetric];
    return {
      ...item,
      metrics: item.metrics.map((value, metric) =>
        metric === item.metrics.length - 1 ? source : value,
      ),
    };
  });
  return { update: { kind: 'replace-rows', rows } };
}
