import type { MarkerRule } from '@cells';
import type { Group, RowData } from '../tree-table.model';
import type { ClusterContext } from './shared/cluster-context';
import { WHOLE, type Depends } from './shared/columns';

const PLANNED_BY_SYSTEM = 'Set by the planning system';

// --- Replenishment days marker rules ----------------------------------------------------------

const plannedBySystem: MarkerRule<RowData, number> = ({ row }) =>
  row.autoReorder && PLANNED_BY_SYSTEM;

// --- Cluster -----------------------------------------------------------------------------------

export function replenishmentTimeCluster({ canEdit, editNumber, toggle }: ClusterContext): Group {
  return {
    groupId: 'replenishmentTimeGroup',
    headerName: 'Replenishment',
    marryChildren: true,
    children: [
      editNumber('replenishmentDays', 'Replenishment (days)', WHOLE, {
        markers: { systemGenerated: [plannedBySystem] },
        allowed: (cell) =>
          cell.row.autoReorder
            ? `${PLANNED_BY_SYSTEM}; turn off auto reorder to edit it`
            : canEdit(cell),
        extra: {
          initialWidth: 170,
          context: { dependsOn: ['autoReorder'] } satisfies Depends,
        },
      }),
      toggle(
        'autoReorder',
        'Auto reorder',
        (on) => (on ? 'The planning system sets the replenishment time' : 'Set by hand'),
        { extra: { initialWidth: 120 } },
      ),
    ],
  };
}
