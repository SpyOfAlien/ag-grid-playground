import type { Cell } from './base';
import type { ActionRules } from './control';
import type { CellsContext } from '../grid/cell-grid-options';
import type { Command, CommandFor, MethodOf, SaveCommand } from '../session/persistence';

/**
 * What a change sends: a persistence method and the command for it, checked against each other.
 * Leave `submit` out to save the change to the column's own field.
 */
export type SubmitParams<Row, V, P, Next> = {
  [M in MethodOf<P>]: {
    method: M;
    command: (next: Next, cell: Cell<Row, V>) => CommandFor<P, M>;
  };
}[MethodOf<P>];

/** A cell's action: the control (`allowed`, `label`, `tooltip`) and what a change sends. */
export type ActionParams<Row, V, P, Next> = ActionRules<Row, V> & {
  submit?: SubmitParams<Row, V, P, Next>;
};

/** What sending a change needs from the renderer: the grid context and the column's field. */
export interface EditTarget {
  readonly context: CellsContext;
  readonly colDef?: { readonly field?: string } | null;
}

/** How a submit looks at run time, whatever the persistence. */
export interface RuntimeSubmit<Row, V, Next> {
  readonly method?: string;
  readonly command?: (next: Next, cell: Cell<Row, V>) => Command | undefined;
}

/** Sends a change through the grid's session. The source cell is always attached. */
export function submitEdit<Row, V, Next>(
  target: EditTarget,
  submit: RuntimeSubmit<Row, V, Next> | undefined,
  cell: Cell<Row, V>,
  next: Next,
): Promise<void> {
  const source = { rowId: cell.rowId, columnId: cell.columnId };
  const built = submit?.command ? submit.command(next, cell) : saveToOwnField(target, cell, next);
  return target.context.session.run(submit?.method ?? 'save', { ...built, source });
}

/** Without a `submit`, a change is a save of the column's own top-level field. */
function saveToOwnField<Row, V>(
  target: EditTarget,
  cell: Cell<Row, V>,
  value: unknown,
): SaveCommand<Row> {
  // Only a top-level field can be saved by default; nested paths need a submit.
  const field = target.colDef?.field;
  if (!field || field.includes('.'))
    throw new Error(
      `Column ${cell.columnId} has no top-level field to save to; give its action a submit.`,
    );
  return { changes: [{ rowId: cell.rowId, field: field as keyof Row & string, value }] };
}
