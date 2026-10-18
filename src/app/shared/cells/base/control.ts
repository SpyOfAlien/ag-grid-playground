import { evaluate, type Cell, type CellRule } from './base';
import type { CellSession } from '../grid/cell-grid-options';
import type { TooltipContent } from '../tooltip/tooltip';

export interface CellControl {
  readonly disabled: boolean;
  readonly tooltip: TooltipContent | null;
  /** The control's accessible name. */
  readonly label: string;
}

/**
 * One place decides whether a control can be used and what its tooltip says, in this order:
 * session lock or busy, the cell's `editable` reason, then this cell's last error (the control
 * stays enabled so the user can retry), then the normal tooltip.
 */
export function cellControl<Row, V>(
  config: {
    editable?: CellRule<Row, V, true | string>;
    tooltip?: CellRule<Row, V, TooltipContent | null>;
    label?: CellRule<Row, V, string>;
  },
  cell: Cell<Row, V>,
  session: CellSession,
  defaultLabel: string,
): CellControl {
  const label = config.label ? evaluate(config.label, cell) : defaultLabel;
  return { label, ...access(config, cell, session) };
}

function access<Row, V>(
  config: {
    editable?: CellRule<Row, V, true | string>;
    tooltip?: CellRule<Row, V, TooltipContent | null>;
  },
  cell: Cell<Row, V>,
  session: CellSession,
): Omit<CellControl, 'label'> {
  const tooltip = evaluate(config.tooltip ?? null, cell);
  const locked = session.lockReason();
  if (locked) return { disabled: true, tooltip: locked };

  // While a command runs every control waits, but keeps its normal tooltip.
  if (session.busy()) return { disabled: true, tooltip };

  const editable = evaluate(config.editable ?? true, cell);
  if (editable !== true) return { disabled: true, tooltip: editable };

  const error = session.errorFor({ rowId: cell.rowId, columnId: cell.columnId });

  return { disabled: false, tooltip: error ?? tooltip };
}
