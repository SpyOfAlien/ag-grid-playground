import type { ColDef, GridOptions } from 'ag-grid-community';
import {
  NumberCell,
  EditCell,
  ToggleCell,
  DropdownCell,
  InputEditor,
  TextareaEditor,
  suppressCellControlKeyboard,
  type NumberCellParams,
  type EditCellParams,
  type ToggleCellParams,
  type DropdownCellParams,
  type InputEditorData,
  type TextareaEditorData,
} from '@grid-cells';
import type { EditCommand } from '@grid-cells';
export interface Row {
  id: string;
  amount: number | null;
  enabled: boolean;
  unit: 'kg' | 't';
  notes: string;
}
export interface FeatureActions {
  saveAmount(command: EditCommand<{ value: number | null }>): Promise<void>;
  saveNotes(command: EditCommand<{ value: string }>): Promise<void>;
  saveEnabled(command: EditCommand<{ value: boolean }>): Promise<void>;
  saveUnit(command: EditCommand<{ value: Row['unit'] }>): Promise<void>;
}
export function columns(actions: FeatureActions): ColDef<Row>[] {
  const permission = ({ data }: { data: Readonly<Row> | undefined }) =>
    data?.enabled
      ? { allowed: true as const }
      : { allowed: false as const, reason: 'Enable first' };
  const identity = (cell: { rowId: string | undefined; columnId: string }) => {
    if (!cell.rowId) throw new Error('Missing row.');
    return { rowId: cell.rowId, columnId: cell.columnId };
  };
  const numberParams = {
    content: {
      alignment: 'end',

      number: { decimals: 2, useGrouping: true, unit: ({ data }) => data?.unit ?? null },
    },
  } satisfies NumberCellParams<Row>;
  const inputParams = {
    action: {
      permission,

      editor: {
        component: InputEditor<number>,
        data: (cell) => ({
          initialValue: cell.value ?? null,
          config: { label: 'Amount', mode: 'number' },
          save: (value) =>
            actions.saveAmount({
              cell: identity(cell),
              data: { value },
              queryParams: { source: 'amount' },
            }),
        }),

        presentation: {
          kind: 'popover',
          options: ({ trigger }) => ({
            anchor: { kind: 'element', element: trigger },
            width: 320,
            backdrop: true,
          }),
        },
      },
    },
  } satisfies EditCellParams<Row, number, InputEditorData<number>>;
  const notesParams = {
    action: {
      permission,

      editor: {
        component: TextareaEditor,
        data: (cell) => ({
          initialValue: cell.value ?? '',
          config: { label: 'Notes', rows: 4 },
          save: (value) => actions.saveNotes({ cell: identity(cell), data: { value } }),
        }),

        presentation: { kind: 'dialog', options: { width: 480, backdrop: true } },
      },
    },
  } satisfies EditCellParams<Row, string, TextareaEditorData>;
  const toggleParams = {
    toggle: {
      save: (value, cell) => actions.saveEnabled({ cell: identity(cell), data: { value } }),
    },
  } satisfies ToggleCellParams<Row>;
  const unitParams = {
    dropdown: {
      options: [
        { value: 'kg', label: 'Kilograms' },
        { value: 't', label: 'Tonnes' },
      ],
      permission,
      save: (value, cell) => actions.saveUnit({ cell: identity(cell), data: { value } }),
    },
  } satisfies DropdownCellParams<Row, Row['unit']>;
  return [
    {
      field: 'amount',
      colId: 'display',
      cellClass: 'grid-kit-cell',
      cellRendererSelector: () => ({ component: NumberCell, params: numberParams }),
    },
    {
      field: 'amount',
      cellClass: 'grid-kit-cell',
      cellRendererSelector: () => ({ component: EditCell, params: inputParams }),
    },
    {
      field: 'notes',
      cellClass: 'grid-kit-cell',
      cellRendererSelector: () => ({ component: EditCell, params: notesParams }),
    },
    {
      field: 'enabled',
      cellClass: 'grid-kit-cell',
      cellRendererSelector: () => ({ component: ToggleCell, params: toggleParams }),
    },
    {
      field: 'unit',
      cellClass: 'grid-kit-cell',
      cellRendererSelector: () => ({ component: DropdownCell, params: unitParams }),
    },
  ];
}
export const options = {
  defaultColDef: { suppressKeyboardEvent: suppressCellControlKeyboard },
  getRowId: ({ data }) => data.id,
} satisfies GridOptions<Row>;
