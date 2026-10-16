import type { Signal } from '@angular/core';
import {
  ToggleCell,
  DropdownCell,
  type ToggleCellParams,
  type DropdownCellParams,
  PopoverCell,
  DialogCell,
  type PopoverCellParams,
  type DialogCellParams,
  InputEditor,
  TextareaEditor,
  type InputEditorData,
  type TextareaEditorData,
  type CellContext,
  type EditPermission,
  type CellRule,
  TextCell,
  NumberCell,
  bindCellRenderer,
  type NumberCellParams,
} from '../../shared/grid-cells/public-api';
import type { DemoTablePersistence } from './demo-persistence.model';
import { DemoEditError } from './demo-persistence.model';
import { ToggleNumberCell } from './cells/toggle-number/toggle-number-cell';
import type { ToggleNumberCellParams } from './cells/toggle-number/toggle-number-cell-params.model';
import { DetailsEditor } from './editors/details-editor';
import type { DetailsEditorData } from './editors/details-editor-data.model';
import { Validators } from '@angular/forms';
import { demoReviewPermission } from './demo-edit-permission';
import { ColDef } from 'ag-grid-community';
import { DemoRow } from './demo-row.model';

// Small showcase definitions. Persistence uses stable column identities.
export const DEMO_COLUMNS: ColDef<DemoRow>[] = [
  { field: 'id', headerName: 'Row ID', width: 130 },
  { field: 'name', headerName: 'Text · popover', width: 190 },
  ...Array.from({ length: 8 }, (_, index): ColDef<DemoRow> => ({
    colId: `metric-${index}`,
    headerName: ['Number', 'Disabled number', 'Number · popover'][index] ?? '',
    width: 160,
    cellDataType: 'number',
    valueGetter: ({ data }) => data?.metrics[index] ?? null,
  })),
];

/** Demo wiring only; not the reusable column builder planned for the application. */
export function createCustomDemoColumns(
  isUserEdited: CellRule<DemoRow, number, boolean>,
  persistence: () => DemoTablePersistence,
  showUnits: Signal<boolean>,
): ColDef<DemoRow>[] {
  const permission = (cell: CellContext<DemoRow, unknown>): EditPermission =>
    demoReviewPermission(cell.data);
  const identity = <V>(cell: CellContext<DemoRow, V>) => {
    if (!cell.rowId || !cell.columnId)
      throw new DemoEditError('invalid-command', 'A cell identity is required.');
    return { rowId: cell.rowId, columnId: cell.columnId };
  };
  const toggleParams = {
    content: { alignment: 'center', tooltip: 'Change reviewed status' },
    markers: { warning: { when: ({ value }) => !value, tooltip: 'Review required' } },
    toggle: {
      save: (value, cell) =>
        persistence().saveReview({
          cell: identity(cell),
          data: { value },
          queryParams: { source: 'review-toggle' },
        }),
    },
  } satisfies ToggleCellParams<DemoRow>;
  const unitParams = {
    content: { tooltip: 'Choose the row unit' },
    markers: { info: { when: true, tooltip: 'Unit applies to all row measurements' } },
    dropdown: {
      options: [
        { value: 'kg', label: 'Kilograms (kg)' },
        { value: 't', label: 'Metric tonnes (t)' },
      ],
      placeholder: 'Choose unit',
      permission,
      save: (value, cell) =>
        persistence().saveUnit({
          cell: identity(cell),
          data: { value },
          queryParams: { source: 'unit-dropdown', revision: cell.data?.metadata.revision ?? 0 },
        }),
    },
  } satisfies DropdownCellParams<DemoRow, DemoRow['metadata']['unit']>;
  const nameParams = {
    content: { tooltip: ({ value }) => value ?? null },
    markers: { info: { when: true, tooltip: 'Material name' } },
    action: {
      tooltip: 'Edit material name',
      permission,

      editor: {
        component: InputEditor<string>,
        data: (cell) => ({
          initialValue: cell.value ?? null,
          config: {
            label: 'Value',
            mode: 'text',
            validators: [Validators.required, Validators.maxLength(60)],
          },
          save: (value) =>
            persistence().saveName({
              cell: identity(cell),
              data: { value },
              queryParams: { source: 'name-editor' },
            }),
        }),

        popover: ({ trigger }) => ({
          anchor: { kind: 'element', element: trigger },
          placement: 'bottom',
          title: 'Edit material name',
          width: 320,
        }),
      },
    },
  } satisfies PopoverCellParams<DemoRow, string, InputEditorData<string>>;
  const amountParams = {
    content: {
      alignment: 'end',
      tooltip: ({ value }) => (value == null ? null : String(value)),

      number: {
        locale: 'en-US',
        decimals: 2,
        useGrouping: true,
        unit: ({ data }) => (showUnits() ? (data?.metadata.unit ?? null) : null),
      },
    },
    markers: { systemGenerated: { when: true, tooltip: 'System generated value' } },
    action: {
      tooltip: 'Edit measurement',
      permission,

      editor: {
        component: InputEditor<number>,
        data: (cell) => ({
          initialValue: cell.value ?? null,
          config: {
            label: 'Value',
            mode: 'number',
            validators: [Validators.required, Validators.min(0), Validators.max(1000000)],
          },
          save: (value) =>
            persistence().saveAmount({
              cell: identity(cell),
              data: { value },
              queryParams: { source: 'amount-editor', revision: cell.data?.metadata.revision ?? 0 },
            }),
        }),

        popover: ({ trigger }) => ({
          anchor: { kind: 'element', element: trigger },
          placement: 'bottom',
          title: 'Edit measurement',
          width: 320,
        }),
      },
    },
  } satisfies PopoverCellParams<DemoRow, number, InputEditorData<number>>;
  const notesParams = {
    content: { tooltip: ({ value }) => value || null },
    action: {
      tooltip: 'Edit notes',
      permission,

      editor: {
        component: TextareaEditor,
        data: (cell) => ({
          initialValue: cell.value ?? '',
          config: {
            label: 'Value',
            rows: 5,
            placeholder: 'Add notes',
            validators: [Validators.maxLength(2000)],
          },
          save: (value) =>
            persistence().saveNotes({
              cell: identity(cell),
              data: { value },
              queryParams: { source: 'notes-editor' },
            }),
        }),

        dialog: { title: 'Edit notes', width: 480, maxHeight: 600, backdrop: true },
      },
    },
  } satisfies DialogCellParams<DemoRow, string, TextareaEditorData>;
  return DEMO_COLUMNS.map((column, position): ColDef<DemoRow> => {
    if (position < 2) {
      return {
        ...column,
        cellClass: 'grid-kit-cell',
        ...(position === 1
          ? bindCellRenderer(PopoverCell<DemoRow, string, InputEditorData<string>>, nameParams)
          : bindCellRenderer(TextCell<DemoRow>, {})),
      };
    }
    const index = position - 2;
    if (index === 7) {
      const compositeParams = {
        content: {
          alignment: 'end',
          disabled: ({ data }) => !data?.metadata.reviewed,
          tooltip: 'Review status and measurement',

          number: {
            decimals: 2,
            useGrouping: true,
            unit: ({ data }) => (showUnits() ? (data?.metadata.unit ?? null) : null),
          },
        },
        markers: {
          warning: { when: ({ data }) => !data?.metadata.reviewed, tooltip: 'Review required' },
        },
        toggle: {
          permission: { allowed: true },
          checked: ({ data }) => data?.metadata.reviewed ?? false,
          save: (value, cell) =>
            persistence().saveReview({
              cell: identity(cell),
              data: { value },
              queryParams: { source: 'composite-review' },
            }),
        },
        action: {
          tooltip: 'Edit composite measurement',
          permission,

          editor: {
            component: InputEditor<number>,
            data: (cell) => ({
              initialValue: cell.value ?? null,
              config: {
                label: 'Value',
                mode: 'number',
                validators: [Validators.required, Validators.min(0), Validators.max(1000000)],
              },
              save: (value) =>
                persistence().saveAmount({
                  cell: identity(cell),
                  data: { value },
                  queryParams: {
                    source: 'composite-number',
                    revision: cell.data?.metadata.revision ?? 0,
                  },
                }),
            }),

            popover: ({ trigger }) => ({
              anchor: { kind: 'element', element: trigger },
              placement: 'bottom',
              title: 'Edit composite measurement',
              width: 320,
            }),
          },
        },
      } satisfies ToggleNumberCellParams<DemoRow>;
      return {
        ...column,
        colId: 'toggle-number',
        headerName: 'Review + amount',
        width: 240,
        valueFormatter: undefined,
        cellClass: 'grid-kit-cell',
        ...bindCellRenderer(ToggleNumberCell<DemoRow, InputEditorData<number>>, compositeParams),
      };
    }
    if (index === 5 || index === 6)
      return {
        ...column,
        colId: index === 5 ? 'review-toggle' : 'unit-dropdown',
        headerName: index === 5 ? 'Reviewed' : 'Unit',
        cellDataType: index === 5 ? 'boolean' : 'text',
        type: undefined,
        valueGetter: ({ data }) => (index === 5 ? data?.metadata.reviewed : data?.metadata.unit),
        valueFormatter: undefined,
        cellClass: 'grid-kit-cell',
        ...(index === 5
          ? bindCellRenderer(ToggleCell<DemoRow>, toggleParams)
          : bindCellRenderer(DropdownCell<DemoRow, DemoRow['metadata']['unit']>, unitParams)),
      };
    if (index === 2)
      return {
        ...column,
        valueFormatter: undefined,
        cellClass: 'grid-kit-cell',
        ...bindCellRenderer(PopoverCell<DemoRow, number, InputEditorData<number>>, amountParams),
      };
    if (index === 3)
      return {
        ...column,
        colId: 'notes',
        headerName: 'Textarea · dialog',
        cellDataType: 'text',
        type: undefined,
        valueGetter: ({ data }) => data?.notes ?? '',
        valueFormatter: undefined,
        cellClass: 'grid-kit-cell',
        ...bindCellRenderer(DialogCell<DemoRow, string, TextareaEditorData>, notesParams),
      };
    if (index === 4) {
      const detailsParams = {
        content: { tooltip: ({ data }) => data?.name ?? null },
        markers: {
          warning: { when: ({ data }) => !data?.metadata.reviewed, tooltip: 'Review required' },
        },
        action: {
          tooltip: 'Edit row details',

          editor: {
            component: DetailsEditor,
            data: (cell) => {
              const row = cell.data;
              if (!row) throw new DemoEditError('missing-row', 'The edited row no longer exists.');
              return {
                cell: identity(cell),
                initialValue: {
                  name: row.name,
                  amount: row.metrics[2] ?? null,
                  notes: row.notes ?? '',
                  revision: row.metadata.revision,
                },
                queryParams: { source: 'details-editor' },
              };
            },

            dialog: { title: 'Edit row details', width: 520, maxHeight: 650, backdrop: true },
          },
        },
      } satisfies DialogCellParams<DemoRow, string, DetailsEditorData>;
      return {
        ...column,
        colId: 'details',
        headerName: 'Complex · dialog',
        cellDataType: 'text',
        type: undefined,
        valueGetter: ({ data }) => (data ? 'Open details' : ''),
        valueFormatter: undefined,
        width: 160,
        cellClass: 'grid-kit-cell',
        ...bindCellRenderer(DialogCell<DemoRow, string, DetailsEditorData>, detailsParams),
      };
    }
    const params = {
      content: {
        alignment: 'end',
        highlighted: ({ data }) => index === 0 && !data?.metadata.reviewed,
        disabled: ({ data }) => index === 1 && !data?.metadata.reviewed,
        tooltip: ({ value, data }) =>
          value == null ? null : `${value} ${data?.metadata.unit ?? ''}`.trim(),

        number: {
          locale: 'en-US',
          decimals: 2,
          useGrouping: true,
          unit: ({ data }) => (showUnits() ? (data?.metadata.unit ?? null) : null),
        },
      },
      markers: {
        error: {
          when: ({ data }) => index === 0 && data !== undefined && !data.metadata.reviewed,
          tooltip: 'Measurement needs review',
        },
        warning: {
          when: ({ value }) => value != null && value > 9000,
          tooltip: 'High measurement',
        },
        userEdited: { when: isUserEdited, tooltip: 'User edited value' },
        systemGenerated: { when: index % 3 === 0, tooltip: 'System generated value' },
        info: { when: index % 3 === 1, tooltip: 'Measurement information' },
        special: { when: true, tooltip: 'Special measurement' },
      },
    } satisfies NumberCellParams<DemoRow>;
    return {
      ...column,
      valueFormatter: undefined,
      cellClass: 'grid-kit-cell',
      ...bindCellRenderer(NumberCell<DemoRow>, params),
    };
  });
}
