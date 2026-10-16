import type { EditorHostService } from '../editing/editor-host/public-api';

/** Optional shared services; application context can extend this interface. */
export interface GridContext {
  readonly editorHost?: EditorHostService;
}
