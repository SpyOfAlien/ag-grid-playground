import type {
  ActionPart,
  CellEditorConfig,
  ContentPart,
  EditablePart,
  InputEditorData,
  MarkerPart,
  TogglePart,
} from '@grid-cells';

export type ToggleNumberCellParams<R, D = InputEditorData<number>> = ContentPart<R, number> &
  MarkerPart<R, number> &
  EditablePart<R, number> &
  ActionPart<R, number, CellEditorConfig<R, number, D>> &
  TogglePart<R, number>;
