// Always in scope.
import type { MarkerRule } from '@cells';
import { byTable } from '../by-table';
import type { Group, RowData } from '../tree-table.model';
import type { ClusterContext } from './shared/cluster-context';
import { leaf, text, WHOLE, type Depends, type Field } from './shared/columns';

// --- Quantity marker rules --------------------------------------------------------------------

const notFullyShipped: MarkerRule<RowData, number> = ({ row, value }) => {
  if (!leaf(row)) return null;
  const open = row.quantity - (value ?? 0);
  return open > 0 && `${open} of ${row.quantity} not shipped yet`;
};

// --- Cluster -----------------------------------------------------------------------------------

export function coreCluster({ table, editNumber }: ClusterContext): Group {
  return {
    groupId: 'coreGroup',
    headerName: 'Item',
    marryChildren: true,
    children: [
      editNumber(
        'quantity',
        byTable(table, { default: 'Quantity', outbound: 'Shipped qty' }),
        WHOLE,
        {
          field: byTable<Field>(table, { default: 'quantity', outbound: 'shippedQuantity' }),
          markers: {
            warning: byTable(table, { outbound: [notFullyShipped] }),
          },
          extra: {
            initialWidth: 140,
            context: { dependsOn: ['shipmentStatus', 'quantity'] } satisfies Depends,
          },
        },
      ),
      text('unit', 'Unit', {}, { initialHide: true, initialWidth: 90 }),
    ],
  };
}
