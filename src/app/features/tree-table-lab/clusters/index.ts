// The cluster registry. Each cluster owns its getters, warnings, editable rules and columns, in its
// own file; `shared/` holds what more than one cluster uses.
//
// Column ids are unique across all clusters: saved layouts match by id. Group ids end in "Group":
// AG Grid renames a column whose id a group already uses (freightCost → freightCost_1), and its
// state no longer applies.
import type { ClusterId, Group, TableType } from '../tree-table.model';
import { bomStructureCluster } from './bom-structure';
import { coreCluster } from './core';
import { emptyReturnCluster } from './empty-return';
import { freightCostCluster } from './freight-cost';
import { inventoryValueCluster } from './inventory-value';
import { packConceptCluster } from './pack-concept';
import { packDimensionsCluster } from './pack-dimensions';
import { replenishmentTimeCluster } from './replenishment-time';
import { clusterContext, type ClusterContext } from './shared/cluster-context';
import { stockCoverageCluster } from './stock-coverage';
import { transportLeadTimeCluster } from './transport-lead-time';

const builders: Record<ClusterId, (context: ClusterContext) => Group> = {
  core: coreCluster,
  bomStructure: bomStructureCluster,
  freightCost: freightCostCluster,
  transportLeadTime: transportLeadTimeCluster,
  emptyReturn: emptyReturnCluster,
  packDimensions: packDimensionsCluster,
  packConcept: packConceptCluster,
  stockCoverage: stockCoverageCluster,
  inventoryValue: inventoryValueCluster,
  replenishmentTime: replenishmentTimeCluster,
};

/** The clusters of one table, with that table's getters and rules. */
export function clusterDefs(table: TableType): Record<ClusterId, Group> {
  const context = clusterContext(table);
  return Object.fromEntries(
    Object.entries(builders).map(([id, build]) => [id, build(context)]),
  ) as Record<ClusterId, Group>;
}

export const clusterOrder: readonly ClusterId[] = [
  'core',
  'bomStructure',
  'freightCost',
  'transportLeadTime',
  'emptyReturn',
  'packDimensions',
  'packConcept',
  'stockCoverage',
  'inventoryValue',
  'replenishmentTime',
];
