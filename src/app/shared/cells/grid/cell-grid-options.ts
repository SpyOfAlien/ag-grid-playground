import type { GridApi, GridOptions } from 'ag-grid-community';
import type { EditSession } from '../session/edit-session';
import type { EditPersistence } from '../session/persistence';
import { cellSession, type CellsContext } from './cells-context';
import { connectGrid } from './connect-grid';
import { suppressCellKeyboard } from './keyboard';
import { columnDependencyGraph } from './column-dependencies';

/**
 * The only way to build a cell grid: it cannot exist without a session. Rows come from the
 * session, so `rowData` and `getRowId` are not options.
 */
export function cellGridOptions<Row, P extends EditPersistence<Row>>(
  session: EditSession<Row, P>,
  options: Omit<GridOptions<Row>, 'context' | 'rowData' | 'getRowId'>,
): GridOptions<Row> {
  // Rejects a cycle now rather than at first render; the grid rebuilds the graph from its columns.
  columnDependencyGraph(options.columnDefs ?? []);
  // One options object can back several grids; each connects and disconnects on its own.
  const disconnects = new Map<GridApi<Row>, () => void>();
  return {
    ...options,
    context: { session: cellSession(session) } satisfies CellsContext,
    getRowId: ({ data }) => session.rowId(data),
    defaultColDef: { suppressKeyboardEvent: suppressCellKeyboard, ...options.defaultColDef },
    onGridReady: (event) => {
      disconnects.set(event.api, session.connect(connectGrid(event.api)));
      options.onGridReady?.(event);
    },
    onGridPreDestroyed: (event) => {
      disconnects.get(event.api)?.();
      disconnects.delete(event.api);
      options.onGridPreDestroyed?.(event);
    },
  };
}
