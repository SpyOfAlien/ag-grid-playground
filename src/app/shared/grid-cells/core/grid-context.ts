import type { ICellRendererParams } from 'ag-grid-community';
import type { CellOperations } from '../capabilities/save';
import type { EditorHostService } from '../editing/editor-host/editor-host-service';

/** Optional shared services; application context can extend this interface. */
export interface GridContext {
  readonly editorHost?: EditorHostService;
  /** Shares direct-control save state across recycled renderers. */
  readonly cellOperations?: CellOperations;
}

export type RendererParams<R, V, C> = ICellRendererParams<R, V, GridContext> & C;

export function requireEditorHost(context: GridContext | undefined): EditorHostService {
  const host = context?.editorHost;
  if (!host) throw new Error('Provide editorHost in grid context.');
  return host;
}
