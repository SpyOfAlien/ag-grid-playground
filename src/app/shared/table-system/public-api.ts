export { TableModel } from './model/table-model';
export type {
  RowIdentity,
  CellAddress,
  EditTarget,
  DatasetIdentity,
  TableUpdate,
} from './model/table-model';
export { OperationController } from './operations/operation-controller';
export type {
  Operation,
  OperationStatus,
  SubmissionOutcome,
  ConflictScope,
} from './operations/operation-controller';
export { TableProjection } from './ag-grid/table-projection';
export { defineColumn } from './ag-grid/typed-columns';
export type {
  TableColumn,
  ColumnInteraction,
  ColumnEditor,
  EditorContent,
} from './ag-grid/typed-columns';
export { EditorSession, EditorSessions } from './editors/editor-session';
export { TableEditorHost } from './hosts/editor-host';
export { NumberCell } from './renderers/number-cell';
export { NumberEditor } from './editors/number-editor';
export { TextEditor } from './editors/text-editor';
export {
  computeNumber,
  computeText,
  computeMarker,
  computeDescription,
  computeChoice,
} from './presentation/display';
export type { NumberDisplay, Annotation, Choice } from './presentation/display';
export { RevisionConflictError } from './model/errors';
export type { TableInteractionContext } from './interactions/editor-binding';
