// Editable column builders: one per kind of editing. Each takes the table's edit rule.
import { Validators } from '@angular/forms';
import {
  DialogCell,
  DropdownCell,
  FieldEditor,
  formatNumber,
  PopoverCell,
  ToggleCell,
  type CellRule,
  type DialogCellParams,
  type DropdownCellParams,
  type FieldEditorData,
  type Markers,
  type NumberFormat,
  type PopoverCellParams,
  type ToggleCellParams,
} from '@cells';
import type { TreeTablePersistence } from '../../tree-table-persistence';
import type { Col, RowData } from '../../tree-table.model';
import { withEdited } from './marker-rules';
import type { EditableField } from './columns';

type P = TreeTablePersistence;

/** Whether a row can be edited: `true`, or the reason it cannot. */
export type EditRule = (cell: { row: RowData }) => true | string;

export interface EditOptions<V> {
  /** The row field the column shows and saves; defaults to the column id. */
  field?: EditableField;
  /** The rules of each marker kind; the builder adds "edited by a user". */
  markers?: Markers<RowData, V>;
  /** Defaults to the table's edit rule. */
  allowed?: CellRule<RowData, V, true | string>;
  /** The editor's label; defaults to the header. */
  label?: string;
  extra?: Col;
}

export interface EditColumns {
  /** A number edited in a popover. */
  editNumber(
    colId: string,
    headerName: string,
    format: NumberFormat<RowData>,
    options?: EditOptions<number>,
  ): Col;
  /** A short text edited in a popover. */
  editText(colId: EditableField, headerName: string, options?: EditOptions<string>): Col;
  /** Longer text edited in a dialog; the cell shows the first line. */
  editNotes(colId: EditableField, headerName: string, options?: EditOptions<string>): Col;
  /** One choice from a fixed list. */
  dropdown(
    colId: EditableField,
    headerName: string,
    choices: readonly { value: string; label: string }[],
    options?: EditOptions<string>,
  ): Col;
  /** A switch; `hint` is its tooltip for each state. */
  toggle(
    colId: EditableField,
    headerName: string,
    hint: (on: boolean) => string,
    options?: EditOptions<boolean>,
  ): Col;
}

export function editColumns(canEdit: EditRule): EditColumns {
  return {
    editNumber: (colId, headerName, format, options = {}) => {
      const field = options.field ?? (colId as EditableField);
      const label = options.label ?? headerName;
      return {
        colId,
        field,
        headerName,
        cellClass: 'cells-align-end',
        cellRenderer: PopoverCell,
        cellRendererParams: {
          markers: withEdited(field, options.markers),
          content: { format: (value, cell) => formatNumber(format, { ...cell, value }) },
          action: {
            allowed: options.allowed ?? canEdit,
            editor: {
              component: FieldEditor<RowData, number>,
              data: () => ({
                label,
                mode: 'number',
                validators: [Validators.required, Validators.min(0)],
              }),
            },
            popover: { title: `Edit ${label.toLowerCase()}`, width: 280 },
          },
        } satisfies PopoverCellParams<FieldEditorData<RowData, number>, P>,
        ...options.extra,
      };
    },

    editText: (colId, headerName, options = {}) => {
      const label = options.label ?? headerName;
      return {
        colId,
        field: colId,
        headerName,
        cellRenderer: PopoverCell,
        cellRendererParams: {
          markers: withEdited(colId, options.markers),
          action: {
            allowed: options.allowed ?? canEdit,
            editor: {
              component: FieldEditor<RowData, string>,
              data: () => ({ label, mode: 'text', validators: [Validators.maxLength(40)] }),
            },
            popover: { title: `Edit ${label.toLowerCase()}`, width: 300 },
          },
        } satisfies PopoverCellParams<FieldEditorData<RowData, string>, P>,
        ...options.extra,
      };
    },

    editNotes: (colId, headerName, options = {}) => {
      const label = options.label ?? headerName;
      return {
        colId,
        field: colId,
        headerName,
        cellRenderer: DialogCell,
        cellRendererParams: {
          markers: withEdited(colId, options.markers),
          content: {
            format: (notes) => notes?.split('\n')[0] ?? '',
            tooltip: ({ value }) => value || null,
          },
          action: {
            allowed: options.allowed ?? canEdit,
            editor: {
              component: FieldEditor<RowData, string>,
              data: () => ({ label, mode: 'multiline' }),
            },
            dialog: { title: `Edit ${label.toLowerCase()}`, width: 480 },
          },
        } satisfies DialogCellParams<FieldEditorData<RowData, string>, P>,
        ...options.extra,
      };
    },

    dropdown: (colId, headerName, choices, options = {}) => ({
      colId,
      field: colId,
      headerName,
      cellRenderer: DropdownCell,
      cellRendererParams: {
        markers: withEdited(colId, options.markers),
        content: { placeholder: 'Choose…' },
        action: { allowed: options.allowed ?? canEdit, options: choices },
      } satisfies DropdownCellParams<RowData, string, P>,
      ...options.extra,
    }),

    toggle: (colId, headerName, hint, options = {}) => ({
      colId,
      field: colId,
      headerName,
      cellRenderer: ToggleCell,
      cellRendererParams: {
        markers: withEdited(colId, options.markers),
        action: { allowed: options.allowed ?? canEdit, tooltip: ({ value }) => hint(!!value) },
      } satisfies ToggleCellParams<RowData, P>,
      ...options.extra,
    }),
  };
}
