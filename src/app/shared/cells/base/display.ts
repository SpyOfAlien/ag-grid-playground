import { evaluate, type Cell, type CellRule } from './base';
import { topMarker, type ActiveMarker, type Markers } from './markers';
import type { TooltipContent, TooltipPosition } from '../tooltip/tooltip';

/** How a cell shows its value: the text in the middle of the cell. */
export interface ContentParams<Row, V> {
  /** Text for the value; also called for empty values. Defaults to the value as is. */
  format?: (value: V | null | undefined, cell: Cell<Row, V>) => string;
  /** On the value text. */
  tooltip?: CellRule<Row, V, TooltipContent | null>;
  highlighted?: CellRule<Row, V, boolean>;
  muted?: CellRule<Row, V, boolean>;
}

/** The parts every renderer shares: markers, content (shaped by `C`) and where tooltips show. */
export interface DisplayParams<Row, V, C = ContentParams<Row, V>> {
  markers?: Markers<Row, V>;
  content?: C;
  /** Where this column's tooltips show; defaults to below. */
  tooltipPosition?: TooltipPosition;
}

export interface CellDisplay {
  readonly text: string;
  readonly tooltip: TooltipContent | null;
  readonly tooltipPosition: TooltipPosition | null;
  readonly highlighted: boolean;
  readonly muted: boolean;
  readonly marker: ActiveMarker | null;
}

export function cellDisplay<Row, V>(
  params: DisplayParams<Row, V, ContentParams<Row, V>>,
  cell: Cell<Row, V>,
  defaultText: (value: V | null | undefined) => string = (value) => (value ?? '').toString(),
): CellDisplay {
  const content = params.content ?? {};
  return {
    text: content.format ? content.format(cell.value, cell) : defaultText(cell.value),
    tooltip: evaluate(content.tooltip ?? null, cell),
    tooltipPosition: params.tooltipPosition ?? null,
    highlighted: evaluate(content.highlighted ?? false, cell),
    muted: evaluate(content.muted ?? false, cell),
    marker: topMarker(params.markers, cell),
  };
}
