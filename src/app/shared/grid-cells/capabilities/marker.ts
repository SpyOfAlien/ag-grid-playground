import { computed, Directive, inject, InjectionToken, input, type Provider } from '@angular/core';
import {
  evaluateCellRule,
  toCellContext,
  type CellContext,
  type CellFacts,
  type CellRule,
} from '../core/cell-context';

/** Built-in marker kinds. Augment this interface to add a kind, then register its definition. */
export interface MarkerKinds {
  error: true;
  warning: true;
  userEdited: true;
  systemGenerated: true;
  info: true;
  special: true;
}

export type MarkerKind = keyof MarkerKinds & string;

export interface MarkerDefinition {
  readonly kind: MarkerKind;
  readonly label: string;
}

export interface MarkerRule<R, V> {
  when: CellRule<R, V, boolean>;
  tooltip?: CellRule<R, V, string | null>;
}

export interface MarkerPart<R, V> {
  markers?: Partial<Record<MarkerKind, MarkerRule<R, V>>>;
}

export interface Marker {
  readonly kind: MarkerKind;
  readonly tooltip: string | null;
}

/** The highest-priority marker is drawn; every active marker is described. */
export interface MarkerState extends Marker {
  readonly additional: readonly Marker[];
}

/** Ordered by priority, highest first. */
export const DEFAULT_MARKER_DEFINITIONS: readonly MarkerDefinition[] = [
  { kind: 'error', label: 'Error' },
  { kind: 'warning', label: 'Warning' },
  { kind: 'userEdited', label: 'User edited value' },
  { kind: 'systemGenerated', label: 'System generated value' },
  { kind: 'info', label: 'Information' },
  { kind: 'special', label: 'Special case' },
];

export const GRID_CELL_MARKERS = new InjectionToken<readonly MarkerDefinition[]>(
  'GRID_CELL_MARKERS',
  { providedIn: 'root', factory: () => DEFAULT_MARKER_DEFINITIONS },
);

/** Replace the priority order and labels, for example to add a kind or translate labels. */
export function provideGridCellMarkers(definitions: readonly MarkerDefinition[]): Provider {
  return { provide: GRID_CELL_MARKERS, useValue: definitions };
}

export function computeMarker<R, V>(
  params: (CellFacts<R, V> & MarkerPart<R, V>) | null,
  cell: CellContext<R, V> | null = params && toCellContext(params),
  definitions: readonly MarkerDefinition[] = DEFAULT_MARKER_DEFINITIONS,
): MarkerState | null {
  const markers = params?.markers;
  if (!markers || !cell) return null;
  const active: Marker[] = [];
  // Configured kinds without a definition still count, after every defined kind.
  const order = definitions.map((definition) => definition.kind);
  for (const kind of Object.keys(markers) as MarkerKind[])
    if (!order.includes(kind)) order.push(kind);
  for (const kind of order) {
    const rule = markers[kind];
    if (rule && evaluateCellRule(rule.when, cell))
      active.push({ kind, tooltip: evaluateCellRule(rule.tooltip ?? null, cell) });
  }
  const [primary, ...additional] = active;
  return primary ? { ...primary, additional } : null;
}

@Directive({
  selector: '[cellMarker]',
  host: {
    class: 'grid-cell-marker',
    role: 'img',
    '[attr.data-kind]': 'state().kind',
    '[attr.data-additional]': 'state().additional.length || null',
    '[attr.title]': 'tooltip()',
    '[attr.aria-label]': 'label()',
  },
})
export class CellMarker {
  private readonly definitions = inject(GRID_CELL_MARKERS);

  readonly state = input.required<MarkerState>({ alias: 'cellMarker' });

  protected readonly label = computed(() => {
    const state = this.state();
    return [state, ...state.additional]
      .map(({ kind, tooltip }) => {
        const name = this.definitions.find((item) => item.kind === kind)?.label ?? kind;
        return tooltip ? `${name}: ${tooltip}` : name;
      })
      .join('; ');
  });
  protected readonly tooltip = computed(() => {
    const state = this.state();
    const lines = [state, ...state.additional].flatMap(({ tooltip }) => (tooltip ? [tooltip] : []));
    return lines.length ? lines.join('\n') : null;
  });
}
