import type { MarkerRule } from '@cells';
import type { Group, RowData } from '../tree-table.model';
import type { ClusterContext } from './shared/cluster-context';
import { EURO, leaf, number, WHOLE, type Depends } from './shared/columns';

// --- Return days marker rules -----------------------------------------------------------------

const slowReturn: MarkerRule<RowData, number> = ({ value }) =>
  (value ?? 0) > 30 && 'Empties take more than 30 days to return';

const notTracked: MarkerRule<RowData, number> = ({ row }) =>
  leaf(row) && !row.emptiesTracked && 'Empties are not tracked for this part';

// --- Cluster -----------------------------------------------------------------------------------

export function emptyReturnCluster({ editNumber, toggle }: ClusterContext): Group {
  return {
    groupId: 'emptyReturnGroup',
    headerName: 'Empties',
    marryChildren: true,
    children: [
      toggle('emptiesTracked', 'Tracked', (on) => (on ? 'Empties are tracked' : 'Not tracked'), {
        extra: { initialWidth: 100 },
      }),
      editNumber('emptyReturnDays', 'Return (days)', WHOLE, {
        markers: { warning: [slowReturn], info: [notTracked] },
        extra: {
          initialWidth: 130,
          context: { dependsOn: ['emptiesTracked'] } satisfies Depends,
        },
      }),
      number('emptyReturnCost', 'Return cost', { format: EURO }, { initialWidth: 130 }),
    ],
  };
}
