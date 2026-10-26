// What every cluster gets for its table: the rules more than one cluster uses, and the
// editable column builders bound to the table's edit rule.
import { byTable } from '../../by-table';
import type { RowData, TableType } from '../../tree-table.model';
import { editColumns, type EditColumns, type EditRule } from './edit-columns';

export interface ClusterContext extends EditColumns {
  readonly table: TableType;
  /** Leaves only, and in outbound not once the line has shipped. */
  readonly canEdit: EditRule;
  /** The quantity the table works with: ordered, or shipped in outbound. */
  readonly activeQuantity: (row: RowData) => number;
}

export function clusterContext(table: TableType): ClusterContext {
  const canEdit = byTable<EditRule>(table, {
    default: ({ row }) => (row.parent ? 'Edit the parts below it' : true),
    outbound: ({ row }) =>
      row.parent
        ? 'Edit the lines below it'
        : row.shipmentStatus === 'shipped'
          ? 'Shipped lines are locked'
          : true,
  });
  const activeQuantity = byTable<ClusterContext['activeQuantity']>(table, {
    default: (row) => row.quantity,
    outbound: (row) => row.shippedQuantity,
  });
  return { table, canEdit, activeQuantity, ...editColumns(canEdit) };
}
