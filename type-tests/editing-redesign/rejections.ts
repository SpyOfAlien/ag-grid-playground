import type { CellContext } from '@grid-cells';
import type {
  CellOpenContext,
  EditCellParams,
  DropdownCellParams,
  EditCommand,
  EditorDefinition,
  EditorOpenContext,
  EditorPresentation,
  EditorHostService,
  GridContext,
  InputEditorConfig,
  InputEditorData,
  TextareaEditorData,
  ValueEditorData,
} from '@grid-cells';
import {
  amountParams,
  detailsParams,
  numberDefinition,
  textParams,
  type AmountEdit,
  type DetailsEdit,
  type DetailsEditorData,
  type Row,
  type TablePersistence,
  type Unit,
} from './usage';

declare const editorHost: EditorHostService;
declare const persistence: TablePersistence;
declare const trigger: HTMLElement;
declare const numberCell: CellContext<Row, number>;
declare const textCell: CellContext<Row, string>;
declare const command: EditCommand<AmountEdit>;

// @ts-expect-error Every command requires an explicit originating cell.
const missingCell: EditCommand<AmountEdit> = { data: { value: 1 } };
// @ts-expect-error Both row and column identity are required.
const missingColumn: EditCommand<AmountEdit> = { cell: { rowId: 'one' }, data: { value: 1 } };
// @ts-expect-error A numeric edit intent cannot carry text.
const wrongData: EditCommand<AmountEdit> = { cell: command.cell, data: { value: 'one' } };
// @ts-expect-error Commands contain no executable operation.
const executableCommand: EditCommand<AmountEdit> = { ...command, operation: async () => undefined };
// @ts-expect-error Commands contain typed data, not the old row-change protocol.
const rowChanges: EditCommand<AmountEdit> = { cell: command.cell, changes: { amount: 1 } };
// @ts-expect-error Query params cannot contain nested arbitrary objects.
const wrongQuery: EditCommand<AmountEdit> = { ...command, queryParams: { nested: { value: 1 } } };
// @ts-expect-error Originating identity is readonly.
command.cell.rowId = 'two';

const wrongEditor: EditorDefinition<InputEditorData<number>> = {
  // @ts-expect-error Generic editors cannot accept incompatible component data.
  component: textParams.action.editor.component,
  data: numberDefinition.data,
};
editorHost.open(
  // @ts-expect-error Inference uses the component's data type, not a widened union.
  { component: numberDefinition.component, data: textParams.action.editor.data(textCell) },
  { kind: 'popover' },
  { trigger },
);
const wrongFactory: EditCellParams<Row, number, InputEditorData<number>> = {
  action: {
    editor: {
      component: amountParams.action.editor.component,
      // @ts-expect-error A numeric renderer's editor factory cannot produce text data.
      data: () => textParams.action.editor.data(textCell),
    },
  },
};
// @ts-expect-error A numeric input configuration must use number mode.
const wrongMode: InputEditorConfig<number> = { label: 'Amount', mode: 'text' };
// @ts-expect-error Number editor save accepts numbers or null, not strings.
numberDefinition.data.save('one');
// @ts-expect-error Field configuration no longer maps rows through ChangeConfig.
const changeConfig: InputEditorConfig<number> = { label: 'Amount', mode: 'number', change: {} };
const wrongValidator: InputEditorConfig<number> = {
  label: 'Amount',
  mode: 'number',
  // @ts-expect-error Generic field validators must be Angular field validators.
  validators: [42],
};
const synchronousSave: ValueEditorData<number, InputEditorConfig<number>> = {
  initialValue: 1,
  config: { label: 'Amount', mode: 'number' },
  // @ts-expect-error A save must complete asynchronously after commit.
  save: () => undefined,
};
const rowResult: ValueEditorData<number, InputEditorConfig<number>> = {
  initialValue: 1,
  config: { label: 'Amount', mode: 'number' },
  // @ts-expect-error A save returns void; the editor does not consume a generic row update.
  save: async () => ({ kind: 'patch-row' }),
};
const wrongTextarea: TextareaEditorData = {
  // @ts-expect-error Textarea draft is text, not a numeric value.
  initialValue: 1,
  config: { label: 'Notes' },
  save: async () => undefined,
};

// @ts-expect-error A dialog has no popover placement option.
const dialogPlacement: EditorPresentation = { kind: 'dialog', options: { placement: 'bottom' } };
const popoverMaterialOption: EditorPresentation = {
  kind: 'popover',
  // @ts-expect-error A popover does not accept native Material dialog-only config.
  options: { disableClose: true },
};
// @ts-expect-error Supported presentation kinds are explicit.
const tooltip: EditorPresentation = { kind: 'tooltip' };
// @ts-expect-error Grid opening requires its activation trigger.
const missingTrigger: EditorOpenContext = {};
// @ts-expect-error Owner injection/lifetime is captured by the feature-scoped service.
const manualOwner: EditorOpenContext = { trigger, owner: {} };
const clickPoint: CellOpenContext<Row, number> = {
  ...numberCell,
  trigger,
  // @ts-expect-error Point anchoring belongs to the app popover, not grid opening context.
  clickPoint: { x: 1, y: 2 },
};
const wrongRendererOptions: EditCellParams<Row, string, DetailsEditorData> = {
  ...detailsParams,
  // @ts-expect-error Dialog renderer params cannot configure a popover.
  popover: { placement: 'bottom' },
};
const topLevelPopover: EditCellParams<Row, number, InputEditorData<number>> = {
  ...amountParams,
  // @ts-expect-error Presentation settings belong under editor.
  popover: { width: 320 },
};
const topLevelDialog: EditCellParams<Row, string, DetailsEditorData> = {
  ...detailsParams,
  // @ts-expect-error Presentation settings belong under editor.
  dialog: { width: 640 },
};
const wrongNestedPopover: EditCellParams<Row, number, InputEditorData<number>> = {
  action: {
    editor: {
      ...amountParams.action.editor,
      presentation: {
        kind: 'dialog',
        options: {
          // @ts-expect-error Dialog options do not include a popover anchor.
          anchor: { kind: 'point', x: 0, y: 0 },
        },
      },
    },
  },
};
const wrongNestedDialog: EditCellParams<Row, string, DetailsEditorData> = {
  action: {
    editor: {
      ...detailsParams.action.editor,
      // @ts-expect-error Presentations name their kind.
      presentation: { options: { width: 640 } },
    },
  },
};
// @ts-expect-error GridContext has no generic edit submission port.
const oldContext: GridContext = { edit: { submit: async () => undefined } };

// @ts-expect-error Domain actions reject an unrelated scalar command.
persistence.saveDetails(command);
// @ts-expect-error Approval carries a revision, not a toggle edit.
persistence.approveDetails({ cell: command.cell, data: { value: true } });
// @ts-expect-error Complex editor data is not the universal value-editor contract.
const genericDetails: ValueEditorData<DetailsEdit, object> =
  detailsParams.action.editor.data(textCell);
const wrongOption: DropdownCellParams<Row, Unit> = {
  // @ts-expect-error Object-valued dropdowns preserve their option value type.
  dropdown: { options: [{ label: 'kg', value: 'kg' }], save: async () => undefined },
};

void [
  missingCell,
  missingColumn,
  wrongData,
  executableCommand,
  rowChanges,
  wrongQuery,
  wrongEditor,
  wrongFactory,
  wrongMode,
  changeConfig,
  wrongValidator,
  synchronousSave,
  rowResult,
  wrongTextarea,
  dialogPlacement,
  popoverMaterialOption,
  tooltip,
  missingTrigger,
  manualOwner,
  clickPoint,
  wrongRendererOptions,
  topLevelPopover,
  topLevelDialog,
  wrongNestedPopover,
  wrongNestedDialog,
  oldContext,
  genericDetails,
  wrongOption,
];
