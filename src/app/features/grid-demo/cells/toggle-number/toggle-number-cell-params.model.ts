import type { ContentPart } from '../../../../shared/grid-cells/capabilities/content/content.model';
import type { MarkerPart } from '../../../../shared/grid-cells/capabilities/marker/marker.model';
import type { ActionPart } from '../../../../shared/grid-cells/capabilities/action/action.model';
import type { TogglePart } from '../../../../shared/grid-cells/capabilities/toggle/toggle.model';
import type { PopoverEditorConfig } from '../../../../shared/grid-cells/editing/editors/editor-presentation.model';
import type { InputEditorData } from '../../../../shared/grid-cells/editing/editors/input/input-editor-config.model';

export type ToggleNumberCellParams<R, D = InputEditorData<number>> = ContentPart<R, number> &
  MarkerPart<R, number> &
  ActionPart<R, number, PopoverEditorConfig<R, number, D>> &
  TogglePart<R, number>;
