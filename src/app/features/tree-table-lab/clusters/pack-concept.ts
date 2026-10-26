import type { MarkerRule } from '@cells';
import type { Group, RowData } from '../tree-table.model';
import type { ClusterContext } from './shared/cluster-context';
import { leaf } from './shared/columns';

const PACK_CONCEPTS = ['Returnable', 'One-way', 'Rack'].map((concept) => ({
  value: concept,
  label: concept,
}));

// --- Concept marker rules ---------------------------------------------------------------------

const oneWayPackaging: MarkerRule<RowData, string> = ({ row, value }) =>
  leaf(row) && value === 'One-way' && 'One-way packaging: check the sustainability target';

// --- Cluster -----------------------------------------------------------------------------------

export function packConceptCluster({ dropdown, editText }: ClusterContext): Group {
  return {
    groupId: 'packConceptGroup',
    headerName: 'Packaging concept',
    marryChildren: true,
    children: [
      dropdown('packConcept', 'Concept', PACK_CONCEPTS, {
        markers: { warning: [oneWayPackaging] },
        extra: { initialWidth: 140 },
      }),
      editText('packType', 'Pack type', { extra: { initialWidth: 140 } }),
    ],
  };
}
