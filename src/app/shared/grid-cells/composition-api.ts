// Building blocks for custom renderers and editors (`@grid-cells/composition`).
export * from './public-api';

export { BaseCell } from './core/base-cell';
export { toCellContext, evaluateCellRule, columnName, type CellFacts } from './core/cell-context';
export { requireEditorHost } from './core/grid-context';

export { CellContent, computeContent, computeTextContent } from './capabilities/content';
export { computeNumberContent, computeValueContent } from './capabilities/number';
export { CellMarker, computeMarker } from './capabilities/marker';
export { CellEditAction, computeAction, openCellEditor } from './capabilities/action';
export { CellToggle, computeToggle } from './capabilities/toggle';
export { CellDropdown, computeDropdown } from './capabilities/dropdown';
export { computePermission, computeControlPermission } from './capabilities/permission';
export {
  trackSave,
  cellSaveTarget,
  errorMessage,
  IDLE_SAVE,
  type SaveTarget,
  type SaveTracker,
} from './capabilities/save';

export { openDropdownEditor } from './renderers/dropdown-cell';
export { DropdownOptions } from './renderers/dropdown-options';
export { FieldEditor } from './editing/editors/field-editor';
