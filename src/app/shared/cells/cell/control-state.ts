import { evaluate, type Cell, type CellRule } from './cell';
import type { CellSession } from '../grid/cell-grid-options';
import type { TooltipContent } from '../tooltip/tooltip';

export interface ControlView {
  readonly disabled: boolean;
  readonly tooltip: TooltipContent | null;
}

/**
 * One place decides whether a control can be used and what its tooltip says, in this order:
 * session lock or busy, the cell's `editable` reason, then this cell's last error (the control
 * stays enabled so the user can retry), then the normal tooltip.
 */
export function controlView<Row, V>(
  config: {
    editable?: CellRule<Row, V, true | string>;
    tooltip?: CellRule<Row, V, TooltipContent | null>;
  },
  cell: Cell<Row, V>,
  session: CellSession,
): ControlView {
  const tooltip = evaluate(config.tooltip ?? null, cell);
  const blocked = session.disabledReason();
  if (blocked) return { disabled: true, tooltip: blocked === 'Saving…' ? tooltip : blocked };
  const editable = evaluate(config.editable ?? true, cell);
  if (editable !== true) return { disabled: true, tooltip: editable };
  const error = session.errorFor({ rowId: cell.rowId, columnId: cell.columnId });
  return { disabled: false, tooltip: error ?? tooltip };
}
