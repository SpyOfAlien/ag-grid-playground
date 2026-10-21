import type { Signal } from '@angular/core';
import type { EditSession } from '../session/edit-session';
import type { CellRef, Command, EditPersistence } from '../session/persistence';

/** What renderers need from the session. Column params type-check methods and payloads. */
export interface CellSession {
  /** Why the page locked the grid, or null. */
  readonly lockReason: Signal<string | null>;
  /** A command is running. */
  readonly busy: Signal<boolean>;
  /** Runs a command; only column params and the page check its method and payload. */
  run(command: {
    readonly method: string;
    readonly payload?: unknown;
    readonly source?: CellRef;
  }): Promise<void>;
}

/** What every cell renderer finds in `params.context`. */
export interface CellsContext {
  readonly session: CellSession;
}

/**
 * Renderers call methods by the names their column params declare; those params are checked
 * against the persistence type, so the runtime call needs no second check here.
 */
export function cellSession<Row, P extends EditPersistence<Row>>(
  session: EditSession<Row, P>,
): CellSession {
  return {
    lockReason: session.lockReason,
    busy: session.busy,
    run: (command) => session.run(command as Command<P>),
  };
}
