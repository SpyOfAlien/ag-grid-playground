// The cells kit (`@cells`): a session-backed edit flow and cell renderers for AG Grid.

// Session and persistence
export {
  createEditSession,
  EditSession,
  type Entry,
  type EntryStatus,
} from './session/edit-session';
export type {
  ApiParams,
  CellRef,
  Command,
  CommandFor,
  CommandOf,
  EditPersistence,
  FieldChange,
  MethodOf,
  Result,
  SaveCommand,
} from './session/persistence';
export { applyChanges } from './session/apply-changes';
export type { RowChanges, ValueChange } from './session/row-changes';

// Grid wiring
export {
  cellGridOptions,
  cellSession,
  type CellSession,
  type CellsContext,
} from './grid/cell-grid-options';
export type { CellColumnContext } from './grid/column-reads';
export { withEmptyState, type EmptyStateColumn } from './grid/empty-state';
export { suppressCellKeyboard } from './grid/keyboard';

// Building blocks for custom renderers
export { CellBase, evaluate, type Cell, type CellParams, type CellRule } from './base/base';
export {
  cellDisplay,
  type CellDisplay,
  type ContentParams,
  type DisplayParams,
} from './base/display';
export { cellControl, type ActionRules, type CellControl } from './base/control';
export { submitEdit, type ActionParams, type EditTarget, type SubmitParams } from './base/edit';
export { formatNumber, type NumberFormat } from './base/format';
export {
  MARKER_KINDS,
  topMarker,
  type ActiveMarker,
  type MarkerKind,
  type MarkerRule,
  type Markers,
} from './base/markers';

// Tooltip
export {
  CellsTooltip,
  CellsTooltipService,
  type TooltipContent,
  type TooltipPosition,
} from './tooltip/tooltip';

// Renderers
export { CellMarker } from './renderers/cell-marker';
export { TextCell, type TextCellParams } from './renderers/text-cell';
export { NumberCell, type NumberCellParams } from './renderers/number-cell';
export { ToggleCell, type ToggleCellParams } from './renderers/toggle-cell';
export {
  DropdownCell,
  type DropdownCellParams,
  type DropdownContentParams,
  type DropdownOption,
} from './renderers/dropdown-cell';
export {
  PopoverCell,
  editState,
  type EditAction,
  type EditCellParams,
  type EditorConfig,
  type PopoverCellParams,
} from './renderers/popover-cell';
export { DialogCell, type DialogCellParams } from './renderers/dialog-cell';

// Editors
export {
  cellEditorData,
  openCellDialog,
  openCellPopover,
  type CellDialogOptions,
  type CellEditor,
  type CellPopoverOptions,
  type EditorData,
  type EditorNext,
  type EditorRow,
  type EditorValue,
} from './editors/editor';
export { FieldEditor, type FieldEditorData } from './editors/field-editor';
export { DropdownOptions, type DropdownOptionsData } from './editors/dropdown-options';
