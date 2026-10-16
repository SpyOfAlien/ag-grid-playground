import type { EditPermission } from '../../shared/grid-cells/capabilities/action/action.model';
import type { DemoRow } from './demo-row.model';
export function demoReviewPermission(row: Readonly<DemoRow> | undefined): EditPermission {
  if (!row) return { allowed: false, reason: 'Row is unavailable.' };
  return row.metadata.reviewed
    ? { allowed: true }
    : { allowed: false, reason: 'Review this row before editing' };
}
