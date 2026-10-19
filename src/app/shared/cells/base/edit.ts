import type { Cell } from './base';
import type { ActionRules } from './control';
import type { CellsContext } from '../grid/cell-grid-options';
import type { MethodOf, PayloadOf, SavePayload } from '../session/persistence';

/**
 * What a change sends: a persistence method and how to build its payload, checked against each
 * other. Leave `command` out to save the change to the column's own field.
 */
export type CommandParams<Row, V, P, Next> = {
  [M in MethodOf<P>]: {
    method: M;
    payload: (next: Next, cell: Cell<Row, V>) => PayloadOf<P, M>;
  };
}[MethodOf<P>];

/** A cell's action: the control (`allowed`, `label`, `tooltip`) and what a change sends. */
export type ActionParams<Row, V, P, Next> = ActionRules<Row, V> & {
  command?: CommandParams<Row, V, P, Next>;
};

/** What sending a change needs from the renderer: the grid context and the column's field. */
export interface EditTarget {
  readonly context: CellsContext;
  readonly colDef?: { readonly field?: string } | null;
}

/** How a command block looks at run time, whatever the persistence. */
export interface RuntimeCommand<Row, V, Next> {
  readonly method?: string;
  readonly payload?: (next: Next, cell: Cell<Row, V>) => unknown;
}

/**
 * Builds the command for a new value (the column's `command` block, or a save to its own field)
 * and runs it through the grid's session. The source cell is always attached.
 */
export function runCommand<Row, V, Next>(
  target: EditTarget,
  command: RuntimeCommand<Row, V, Next> | undefined,
  cell: Cell<Row, V>,
  next: Next,
): Promise<void> {
  const payload = command?.payload
    ? command.payload(next, cell)
    : ownFieldPayload(target, cell, next);

  return target.context.session.run({
    method: command?.method ?? 'save',
    payload,
    source: { rowId: cell.rowId, columnId: cell.columnId },
  });
}

/** The default save's payload: without a `command`, a change goes to the column's own field. */
function ownFieldPayload<Row, V>(
  target: EditTarget,
  cell: Cell<Row, V>,
  value: unknown,
): SavePayload<Row> {
  // Only a top-level field can be saved by default; nested paths need a command.
  const field = target.colDef?.field;
  if (!field || field.includes('.'))
    throw new Error(
      `Column ${cell.columnId} has no top-level field to save to; give its action a command.`,
    );
  return { changes: [{ rowId: cell.rowId, field: field as keyof Row & string, value }] };
}
