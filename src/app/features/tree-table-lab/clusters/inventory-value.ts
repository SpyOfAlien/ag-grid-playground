// Capital employed.
import type { MarkerRule } from '@cells';
import type { Group, RowData } from '../tree-table.model';
import type { ClusterContext } from './shared/cluster-context';
import { computedNumber, EURO } from './shared/columns';

const inventoryValue = (row: RowData) => row.stockOnHand * row.unitCost;

// --- Inventory value marker rules -------------------------------------------------------------

const tooMuchTiedUp: MarkerRule<RowData, number> = ({ value }) =>
  (value ?? 0) > 100_000 && 'More than €100,000 tied up in stock';

// --- Cluster -----------------------------------------------------------------------------------

export function inventoryValueCluster({ editNumber }: ClusterContext): Group {
  return {
    groupId: 'inventoryValueGroup',
    headerName: 'Capital employed',
    marryChildren: true,
    children: [
      editNumber('unitCost', 'Unit cost', EURO, {
        label: 'Unit cost (€)',
        extra: { initialWidth: 120 },
      }),
      computedNumber(
        'inventoryValue',
        'Inventory value',
        inventoryValue,
        'stock × unit cost',
        { format: EURO, markers: { warning: [tooMuchTiedUp] } },
        { initialWidth: 150 },
      ),
      computedNumber(
        'capitalCostPerYear',
        'Capital cost / year',
        (row) => inventoryValue(row) * row.capitalRate,
        'inventory value × capital rate',
        { format: EURO },
        { initialHide: true, initialWidth: 160 },
      ),
    ],
  };
}
