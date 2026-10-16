import type { ContentPart } from '../../capabilities/content/content.model';
import type { MarkerPart } from '../../capabilities/marker/marker.model';
import type { ActionPart } from '../../capabilities/action/action.model';
import type { PopoverEditorConfig } from '../../editing/editors/editor-presentation.model';

export type PopoverCellParams<R, V, D> = ContentPart<R, V> &
  MarkerPart<R, V> &
  ActionPart<R, V, PopoverEditorConfig<R, V, D>>;
