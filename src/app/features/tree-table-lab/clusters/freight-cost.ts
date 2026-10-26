import type { MarkerRule } from '@cells';
import { byTable } from '../by-table';
import type { Group, RowData } from '../tree-table.model';
import type { ClusterContext } from './shared/cluster-context';
import { computedNumber, EURO, leaf } from './shared/columns';

const TRANSPORT_MODES = ['Road', 'Rail', 'Sea', 'Air'].map((mode) => ({
  value: mode,
  label: mode,
}));

// --- Mode marker rules ------------------------------------------------------------------------

const airNeedsApproval: MarkerRule<RowData, string> = ({ row, value }) =>
  leaf(row) && value === 'Air' && 'Air freight needs approval from logistics';

// --- Freight cost marker rules ----------------------------------------------------------------

const unusuallyHigh: MarkerRule<RowData, number> = ({ value }) =>
  (value ?? 0) > 10_000 && 'Freight cost unusually high';

const overOutboundBudget: MarkerRule<RowData, number> = ({ value }) =>
  (value ?? 0) > 5_000 && 'Outbound freight above budget';

// --- Cluster -----------------------------------------------------------------------------------

export function freightCostCluster({
  table,
  activeQuantity,
  dropdown,
  editNumber,
}: ClusterContext): Group {
  return {
    groupId: 'freightCostGroup',
    headerName: 'Freight',
    marryChildren: true,
    children: [
      dropdown('transportMode', 'Mode', TRANSPORT_MODES, {
        markers: { warning: [airNeedsApproval] },
        extra: { initialWidth: 120 },
      }),
      computedNumber(
        'freightCost',
        'Freight cost',
        (row) => row.freightRate * activeQuantity(row),
        'rate × quantity',
        {
          format: EURO,
          markers: {
            warning: byTable(table, { default: [unusuallyHigh], outbound: [overOutboundBudget] }),
          },
        },
        { initialWidth: 150 },
      ),
      editNumber('freightCostPerUnit', 'Cost / unit', EURO, {
        field: 'freightRate',
        label: 'Freight rate (€)',
        extra: { initialHide: true, initialWidth: 130 },
      }),
    ],
  };
}
