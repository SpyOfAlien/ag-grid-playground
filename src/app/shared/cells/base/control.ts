import { evaluate, type Cell, type CellRule } from './base';
import type { CellSession } from '../grid/cell-grid-options';
import type { TooltipContent } from '../tooltip/tooltip';

/** The control the user touches: whether it can be used, its name and its hint. */
export interface ActionRules<Row, V> {
  /** `true` when allowed, otherwise the reason it is not. */
  allowed?: CellRule<Row, V, true | string>;
  /** The name of what the control changes; defaults to the column header. Each renderer phrases
   * it: a switch is named this, a dropdown "Name: choice", a pen "Edit Name". */
  label?: CellRule<Row, V, string>;
  /** The control's hint; a lock or the `allowed` reason takes its place. */
  tooltip?: CellRule<Row, V, TooltipContent | null>;
}

export interface CellControl {
  readonly disabled: boolean;
  readonly tooltip: TooltipContent | null;
  /** What the control changes, for its accessible name. */
  readonly name: string;
}

/**
 * One place decides whether a control can be used and what its tooltip says, in this order:
 * the session lock, busy (keeping the control's tooltip), the `allowed` reason, then the control's
 * tooltip. Failures are not shown on the cell; the page reports them from the session's entries.
 */
export function cellControl<Row, V>(
  action: ActionRules<Row, V> | undefined,
  cell: Cell<Row, V>,
  session: CellSession,
  defaultName: string,
): CellControl {
  const name = action?.label ? evaluate(action.label, cell) : defaultName;
  const tooltip = evaluate(action?.tooltip ?? null, cell);

  const locked = session.lockReason();
  if (locked) return { disabled: true, tooltip: locked, name };

  // While a command runs every control waits, but keeps its tooltip.
  if (session.busy()) return { disabled: true, tooltip, name };

  const allowed = evaluate(action?.allowed ?? true, cell);
  if (allowed !== true) return { disabled: true, tooltip: allowed, name };

  return { disabled: false, tooltip, name };
}
