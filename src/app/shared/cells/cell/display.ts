import { evaluate, type Cell, type CellRule } from './cell';
import { topMarker, type MarkerView, type Markers } from './markers';

/** How every cell shows its value. */
export interface DisplayParams<Row, V> {
  /** Text for the value; also called for empty values. Defaults to the value as is. */
  format?: (value: V | null | undefined, cell: Cell<Row, V>) => string;
  tooltip?: CellRule<Row, V, string | null>;
  highlighted?: CellRule<Row, V, boolean>;
  muted?: CellRule<Row, V, boolean>;
  markers?: Markers<Row, V>;
}

export interface DisplayView {
  readonly text: string;
  readonly tooltip: string | null;
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
    highlighted: evaluate(config.highlighted ?? false, cell),
    muted: evaluate(config.muted ?? false, cell),
    marker: topMarker(config.markers, cell),
  };
}
