// Modes, sub-modes and the clusters each view puts in scope.
import { clusterOrder } from './clusters';
import type { ClusterId, TableType, ViewMode, ViewState } from './tree-table.model';

export const ALL = 'all';
const ALWAYS_IN_SCOPE: readonly ClusterId[] = ['core'];

interface SubModeConfig {
  readonly label: string;
  readonly clusters: readonly ClusterId[];
}

type ModeConfig =
  | {
      readonly label: string;
      readonly clusters: readonly ClusterId[];
      readonly subModes?: undefined;
    }
  | {
      readonly label: string;
      /** "All" puts every sub-mode's clusters in scope. */
      readonly allLabel: string;
      readonly subModes: Readonly<Record<string, SubModeConfig>>;
      readonly clusters?: undefined;
    };

export const modeConfig: Readonly<Record<ViewMode, ModeConfig>> = {
  transport: {
    label: 'Transportation',
    allLabel: 'All',
    subModes: {
      transport: { label: 'Transportation', clusters: ['freightCost', 'transportLeadTime'] },
      empties: { label: 'Empties', clusters: ['emptyReturn'] },
    },
  },
  packaging: {
    label: 'Packaging',
    allLabel: 'All',
    subModes: {
      detail: { label: 'Detail', clusters: ['packDimensions'] },
      concept: { label: 'Concept', clusters: ['packConcept'] },
    },
  },
  daysOnHand: { label: 'Days on hand', clusters: ['stockCoverage'] },
  capitalEmployed: { label: 'Capital employed', clusters: ['inventoryValue'] },
  replenishment: { label: 'Replenishment time', clusters: ['replenishmentTime'] },
};

type TableViewConfig =
  /** No modes (BOM). */
  | { readonly kind: 'fixed'; readonly clusters: readonly ClusterId[] }
  /** The first mode is the default. */
  | { readonly kind: 'modes'; readonly modes: readonly ViewMode[] };

const ALL_MODES: readonly ViewMode[] = [
  'transport',
  'packaging',
  'daysOnHand',
  'capitalEmployed',
  'replenishment',
];

export const tableViews: Readonly<Record<TableType, TableViewConfig>> = {
  bom: {
    kind: 'fixed',
    clusters: ['bomStructure', 'stockCoverage', 'replenishmentTime', 'packDimensions'],
  },
  inbound: { kind: 'modes', modes: ALL_MODES },
  outbound: { kind: 'modes', modes: ALL_MODES },
};

export const hasModes = (table: TableType) => tableViews[table].kind === 'modes';

export const modeOptions = (table: TableType): { key: ViewMode; label: string }[] => {
  const views = tableViews[table];
  return views.kind === 'modes'
    ? views.modes.map((key) => ({ key, label: modeConfig[key].label }))
    : [];
};

/** Sub-mode buttons for a mode, "All" first; empty when it has none. */
export function subModeOptions(mode: ViewMode): { key: string; label: string }[] {
  const config = modeConfig[mode];
  if (!config.subModes) return [];
  return [
    { key: ALL, label: config.allLabel },
    ...Object.entries(config.subModes).map(([key, sub]) => ({ key, label: sub.label })),
  ];
}

/** Fills in the default mode and sub-mode; undefined for a fixed table (BOM). */
export function resolveView(table: TableType, view?: Partial<ViewState>): ViewState | undefined {
  const views = tableViews[table];
  if (views.kind === 'fixed') return undefined;
  const mode = view?.mode && views.modes.includes(view.mode) ? view.mode : views.modes[0];
  const config = modeConfig[mode];
  if (!config.subModes) return { mode };
  // Own keys only: "toString" is not a sub-mode.
  const valid =
    view?.subMode && (view.subMode === ALL || Object.hasOwn(config.subModes, view.subMode));
  return { mode, subMode: valid ? view.subMode : ALL };
}

/** Clusters in scope for one view, in display order. */
export function clustersInScope(table: TableType, view?: ViewState): ClusterId[] {
  const views = tableViews[table];
  let ids: readonly ClusterId[];
  if (views.kind === 'fixed') ids = views.clusters;
  else {
    const resolved = resolveView(table, view)!;
    const config = modeConfig[resolved.mode];
    if (!config.subModes) ids = config.clusters;
    else if (resolved.subMode === ALL)
      ids = Object.values(config.subModes).flatMap((sub) => sub.clusters);
    else ids = config.subModes[resolved.subMode!].clusters;
  }
  const inScope = new Set<ClusterId>([...ALWAYS_IN_SCOPE, ...ids]);
  return clusterOrder.filter((id) => inScope.has(id));
}

/** Every cluster a table can ever show: decides which columns exist. */
export function allClustersForTable(table: TableType): ClusterId[] {
  const views = tableViews[table];
  const all: (ViewState | undefined)[] =
    views.kind === 'fixed'
      ? [undefined]
      : views.modes.map((mode) => (modeConfig[mode].subModes ? { mode, subMode: ALL } : { mode }));
  const ids = new Set(all.flatMap((view) => clustersInScope(table, view)));
  return clusterOrder.filter((id) => ids.has(id));
}
