// Days on hand.
import type { MarkerRule } from '@cells';
import { byTable } from '../by-table';
import type { Group, RowData } from '../tree-table.model';
import type { ClusterContext } from './shared/cluster-context';
import { computedNumber, DAYS, leaf, WHOLE, type Depends } from './shared/columns';

const daysOnHand = (row: RowData) => (row.dailyUsage > 0 ? row.stockOnHand / row.dailyUsage : null);

// --- Stock marker rules -----------------------------------------------------------------------

const belowSafetyStock: MarkerRule<RowData, number> = ({ row, value }) =>
  leaf(row) && (value ?? 0) < row.safetyStock && `Below the safety stock of ${row.safetyStock}`;

// --- Days on hand marker rules ----------------------------------------------------------------

const runsOutBeforeReplenishment: MarkerRule<RowData, number> = ({ row, value }) =>
  value != null && value < row.replenishmentDays && 'Stock runs out before replenishment arrives';

const underOneWeek: MarkerRule<RowData, number> = ({ value }) =>
  value != null && value < 7 && 'Less than one week of stock';

const underThreeDays: MarkerRule<RowData, number> = ({ value }) =>
  value != null && value < 3 && 'Less than 3 days of stock';

// --- Cluster -----------------------------------------------------------------------------------

export function stockCoverageCluster({ table, editNumber }: ClusterContext): Group {
  return {
    groupId: 'stockCoverageGroup',
    headerName: 'Days on hand',
    marryChildren: true,
    children: [
      editNumber('stockOnHand', 'Stock', WHOLE, {
        markers: { error: [belowSafetyStock] },
        extra: {
          initialWidth: 110,
          context: { dependsOn: ['safetyStock'] } satisfies Depends,
        },
      }),
      computedNumber(
        'daysOnHand',
        'DOH',
        daysOnHand,
        'stock ÷ daily usage',
        {
          format: DAYS,
          markers: {
            warning: byTable(table, {
              default: [runsOutBeforeReplenishment, underOneWeek],
              outbound: [underThreeDays],
            }),
          },
        },
        {
          initialWidth: 110,
          context: { dependsOn: ['replenishmentDays'] } satisfies Depends,
        },
      ),
      editNumber('safetyStock', 'Safety stock', WHOLE, {
        extra: { initialHide: true, initialWidth: 120 },
      }),
    ],
  };
}
