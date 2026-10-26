import type { MarkerRule } from '@cells';
import type { Group, RowData } from '../tree-table.model';
import type { ClusterContext } from './shared/cluster-context';
import { leaf, number, text, WHOLE } from './shared/columns';

// --- Pack size marker rules -------------------------------------------------------------------

const noPackSize: MarkerRule<RowData, number> = ({ row, value }) =>
  leaf(row) && !value && 'Pack size is missing';

// --- Weight marker rules ----------------------------------------------------------------------

const needsForklift: MarkerRule<RowData, number> = ({ value }) =>
  (value ?? 0) > 500 && 'Over 500 kg: needs a forklift';

// --- Cluster -----------------------------------------------------------------------------------

export function packDimensionsCluster({ editNumber, editNotes }: ClusterContext): Group {
  return {
    groupId: 'packDimensionsGroup',
    headerName: 'Packaging detail',
    marryChildren: true,
    children: [
      editNumber('packSize', 'Pack size', WHOLE, {
        markers: { error: [noPackSize] },
        extra: { initialWidth: 110 },
      }),
      number(
        'packWeight',
        'Weight',
        { format: { ...WHOLE, unit: 'kg' }, markers: { warning: [needsForklift] } },
        { initialWidth: 110 },
      ),
      text('packDimensions', 'Dimensions', {}, { initialHide: true, initialWidth: 170 }),
      editNotes('packNotes', 'Packing notes', { extra: { initialWidth: 200 } }),
    ],
  };
}
