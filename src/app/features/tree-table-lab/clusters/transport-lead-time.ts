import type { MarkerRule } from '@cells';
import type { Group, RowData } from '../tree-table.model';
import type { ClusterContext } from './shared/cluster-context';
import { leaf, WHOLE } from './shared/columns';

// --- Transit marker rules ---------------------------------------------------------------------

const longTransit: MarkerRule<RowData, number> = ({ value }) =>
  (value ?? 0) > 30 && 'Transit takes more than 30 days';

// --- Carrier marker rules ---------------------------------------------------------------------

const noCarrier: MarkerRule<RowData, string> = ({ row, value }) =>
  leaf(row) && !value && 'No carrier assigned';

// --- Cluster -----------------------------------------------------------------------------------

export function transportLeadTimeCluster({ editNumber, editText }: ClusterContext): Group {
  return {
    groupId: 'transportLeadTimeGroup',
    headerName: 'Lead time',
    marryChildren: true,
    children: [
      editNumber('transitDays', 'Transit (days)', WHOLE, {
        markers: { warning: [longTransit] },
        extra: { initialWidth: 130 },
      }),
      editText('carrier', 'Carrier', {
        markers: { error: [noCarrier] },
        extra: { initialWidth: 160 },
      }),
    ],
  };
}
