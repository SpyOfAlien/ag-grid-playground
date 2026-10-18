import type { Signal } from '@angular/core';
import type { GridOptions } from 'ag-grid-community';
import type { EditSession } from '../session/edit-session';
import type { Command, CommandOf, EditPersistence, MethodOf } from '../session/persistence';
import { connectGrid } from './connect-grid';
import { suppressCellKeyboard } from './keyboard';
import { columnReadsGraph } from './column-reads';

/** What renderers need from the session. Column params type-check methods and commands. */
export interface CellSession {
  /** Why the page locked the grid, or null. */
  readonly lockReason: Signal<string | null>;
  /** A command is running. */
  readonly busy: Signal<boolean>;
  run(method: string, command: Command): Promise<void>;
}

/** What every cell renderer finds in `params.context`. */
export interface CellsContext {
  readonly session: CellSession;
}

/**
 * The only way to build a cell grid: it cannot exist without a session. Rows come from the
 * session, so `rowData` and `getRowId` are not options.
 */
export function cellGridOptions<Row, P extends EditPersistence<Row>>(
  session: EditSession<Row, P>,
  options: Omit<GridOptions<Row>, 'context' | 'rowData' | 'getRowId'>,
): GridOptions<Row> {
  const graph = columnReadsGraph(options.columnDefs ?? []);
  let disconnect: (() => void) | undefined;
  return {
    ...options,
    context: { session: cellSession(session) } satisfies CellsContext,
    getRowId: ({ data }) => session.rowId(data),
    defaultColDef: { suppressKeyboardEvent: suppressCellKeyboard, ...options.defaultColDef },
    onGridReady: (event) => {
      disconnect = session.connect(connectGrid(event.api, graph));
      options.onGridReady?.(event);
    },
    onGridPreDestroyed: (event) => {
      disconnect?.();
      options.onGridPreDestroyed?.(event);
    },
  };
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
    run: (method, command) =>
      session.run(method as MethodOf<P>, command as CommandOf<P, MethodOf<P>>),
  };
}
