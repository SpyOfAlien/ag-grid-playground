import { evaluate, type Cell, type CellRule } from './cell';
import { topMarker, type MarkerView, type Markers } from './markers';
import type { TooltipContent, TooltipPosition } from '../tooltip/tooltip';

/** How every cell shows its value. */
export interface DisplayParams<Row, V> {
  /** Text for the value; also called for empty values. Defaults to the value as is. */
  format?: (value: V | null | undefined, cell: Cell<Row, V>) => string;
  tooltip?: CellRule<Row, V, TooltipContent | null>;
  /** Where this column's tooltips show; defaults to below. */
  tooltipPosition?: TooltipPosition;
  highlighted?: CellRule<Row, V, boolean>;
  muted?: CellRule<Row, V, boolean>;
  markers?: Markers<Row, V>;
}

export interface DisplayView {
  readonly text: string;
  readonly tooltip: TooltipContent | null;
  readonly tooltipPosition: TooltipPosition | null;
  readonly highlighted: boolean;
  readonly muted: boolean;
  readonly marker: MarkerView | null;
}

export function displayView<Row, V>(
  config: DisplayParams<Row, V>,
  cell: Cell<Row, V>,
  defaultText: (value: V | null | undefined) => string = (value) => (value ?? '').toString(),
): DisplayView {
  return {
    text: config.format ? config.format(cell.value, cell) : defaultText(cell.value),
    tooltip: evaluate(config.tooltip ?? null, cell),
    tooltipPosition: config.tooltipPosition ?? null,
    highlighted: evaluate(config.highlighted ?? false, cell),
    muted: evaluate(config.muted ?? false, cell),
    marker: topMarker(config.markers, cell),
  };
}
