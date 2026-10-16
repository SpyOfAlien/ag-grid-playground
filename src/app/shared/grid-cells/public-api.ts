// Column wiring entry point (`@grid-cells`). Custom renderer authors use `@grid-cells/composition`.

// Renderers and their configuration
export { TextCell, type TextCellParams } from './renderers/text-cell';
export { NumberCell, type NumberCellParams } from './renderers/number-cell';
export { EditCell, type EditCellParams } from './renderers/edit-cell';
export { ToggleCell, type ToggleCellParams } from './renderers/toggle-cell';
export { DropdownCell, type DropdownCellParams } from './renderers/dropdown-cell';
export type * from './capabilities/content';
export type * from './capabilities/marker';
export type * from './capabilities/action';
export type * from './capabilities/toggle';
export type * from './capabilities/dropdown';
export type { NumberConfig, NumberContentState } from './capabilities/number';
export type { EditPermission, EditablePart } from './capabilities/permission';
export type { CellContext, CellRule, CellOpenContext } from './core/cell-context';
export type { GridContext, RendererParams } from './core/grid-context';
export { formatNumber } from './capabilities/number';

// Column definitions
export {
  bindCellRenderer,
  bindPlainCell,
  cellColumn,
  type CellColumn,
  type CellRendererConfig,
  type CellRendererValue,
} from './integration/bind-cell-renderer';
export {
  suppressCellControlKeyboard,
  withCellKeyboard,
  withCellKeyboardColumns,
} from './integration/keyboard';

// Feature services and configuration
export { CellOperations, type SaveState, type SaveOutcome } from './capabilities/save';
export {
  GRID_CELL_LABELS,
  DEFAULT_GRID_CELL_LABELS,
  provideGridCellLabels,
  type GridCellLabels,
} from './core/labels';
export {
  GRID_CELL_MARKERS,
  DEFAULT_MARKER_DEFINITIONS,
  provideGridCellMarkers,
} from './capabilities/marker';

// Editing
export * from './editing/editor-host/public-api';
export type * from './editing/edit-command.model';
export type * from './editing/cell-editor';
export {
  InputEditor,
  type InputEditorConfig,
  type InputEditorData,
} from './editing/editors/input-editor';
export {
  TextareaEditor,
  type TextareaEditorConfig,
  type TextareaEditorData,
} from './editing/editors/textarea-editor';
export type { FieldEditorConfig } from './editing/editors/field-editor';
