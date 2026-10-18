import type { Cell, CellRule } from './base';
import type { CellsContext } from '../grid/cell-grid-options';
import type { Command, CommandFor, MethodOf, SaveCommand } from '../session/persistence';

/**
 * How an editable control sends its change. Without a `method` it is a `save`, and `command`
 * (optional) must build a save; with another method of the persistence `P`, `command` is required
 * and must build that method's command.
 */
export type EditParams<Row, V, P, Next> = {
  /** `true` when allowed, otherwise the reason it is not. */
  editable?: CellRule<Row, V, true | string>;
  /** The control's accessible name; each renderer has a default built from the column header. */
  label?: CellRule<Row, V, string>;
} & (SaveEdit<Row, V, P, Next> | OtherMethodEdit<Row, V, P, Next>);

interface SaveEdit<Row, V, P, Next> {
  method?: 'save';
  /** Builds the save; defaults to setting the column's own field. */
  command?: (next: Next, cell: Cell<Row, V>) => CommandFor<P, 'save'>;
}

type OtherMethodEdit<Row, V, P, Next> = {
  [M in Exclude<MethodOf<P>, 'save'>]: {
    method: M;
    command: (next: Next, cell: Cell<Row, V>) => CommandFor<P, M>;
  };
}[Exclude<MethodOf<P>, 'save'>];

/**
 * What sending an edit needs: the grid context, the column's field for the default command,
 * and the control's edit params. Renderer params satisfy it; a composite cell passes one control's
 * params together with `context`.
 */
export interface EditTarget<Row, V, Next> {
  readonly context: CellsContext;
  readonly colDef?: { readonly field?: string } | null;
  readonly method?: string;
  readonly command?: (next: Next, cell: Cell<Row, V>) => Command | undefined;
}

/** Sends a control's change through the grid's session. The source cell is always attached. */
export function submitEdit<Row, V, Next>(
  params: EditTarget<Row, V, Next>,
  cell: Cell<Row, V>,
  next: Next,
): Promise<void> {
  const source = { rowId: cell.rowId, columnId: cell.columnId };
  const built = params.command ? params.command(next, cell) : setOwnField(params, cell, next);
  return params.context.session.run(params.method ?? 'save', { ...built, source });
}

function setOwnField<Row, V>(
  params: EditTarget<Row, V, never>,
  cell: Cell<Row, V>,
  value: unknown,
): SaveCommand<Row> {
  // Only a top-level field can be set by default; nested paths need a command.
  const field = params.colDef?.field;
  if (!field || field.includes('.'))
    throw new Error(`Column ${cell.columnId} has no top-level field; give it a command.`);
  return { changes: [{ rowId: cell.rowId, field: field as keyof Row & string, value }] };
}
