import { InjectionToken, type InputSignal, type Provider, type Type } from '@angular/core';
import { Validators } from '@angular/forms';
import type { GridApi } from 'ag-grid-community';
import type { CellContext } from '@grid-cells';
import {
  EditorHostService,
  type EditCellParams,
  type DropdownCellParams,
  type DropdownEditorData,
  type EditCommand,
  type EditorDefinition,
  type EditorRef,
  type GridContext,
  type HttpQueryParams,
  type InputEditorData,
  type HostedEditor,
  type TextareaEditorData,
  type ToggleCellParams,
  type TogglePart,
} from '@grid-cells';

export interface Row {
  readonly id: string;
  name: string;
  amount: number | null;
  enabled: boolean;
  unit: Unit;
  metadata: { amountEdited: boolean; revision: string };
}

export interface Unit {
  readonly code: string;
}

export interface AmountEdit {
  readonly value: number | null;
}

export interface DetailsEdit {
  readonly description: string;
  readonly enabled: boolean;
  readonly revision: string;
}

export interface DetailsEditorData {
  readonly cell: { readonly rowId: string; readonly columnId: string };
  readonly initialDraft: DetailsEdit;
}

export interface TablePersistence {
  saveAmount(command: EditCommand<AmountEdit>): Promise<void>;
  saveName(command: EditCommand<{ readonly value: string | null }>): Promise<void>;
  saveNotes(command: EditCommand<{ readonly value: string }>): Promise<void>;
  saveEnabled(command: EditCommand<{ readonly value: boolean }>): Promise<void>;
  saveUnit(command: EditCommand<{ readonly value: Unit }>): Promise<void>;
  saveDetails(command: EditCommand<DetailsEdit>): Promise<void>;
  approveDetails(command: EditCommand<{ readonly revision: string }>): Promise<void>;
}

// This token belongs to the feature; the shared kit has no generic persistence token.
export const TABLE_PERSISTENCE = new InjectionToken<TablePersistence>('table persistence');

declare const persistence: TablePersistence;
declare const client: TablePersistence;
declare const server: TablePersistence;
declare const NumberInputEditor: Type<HostedEditor<InputEditorData<number>>>;
declare const TextInputEditor: Type<HostedEditor<InputEditorData<string>>>;
declare const TextareaEditor: Type<HostedEditor<TextareaEditorData>>;
declare const DetailsEditor: Type<HostedEditor<DetailsEditorData>>;
declare const OptionsEditor: Type<HostedEditor<DropdownEditorData<Unit>>>;

// Phase 2 must verify these providers' actual Angular scope at runtime.
export const clientProviders: Provider[] = [
  EditorHostService,
  { provide: TABLE_PERSISTENCE, useValue: client },
];
export const serverProviders: Provider[] = [
  EditorHostService,
  { provide: TABLE_PERSISTENCE, useValue: server },
];

function identity(cell: CellContext<Row, unknown>) {
  if (!cell.rowId || !cell.data) throw new Error('This cell has no editable row.');
  return { rowId: cell.rowId, columnId: cell.columnId };
}

export const amountParams = {
  content: { alignment: 'end' },
  action: {
    tooltip: 'Edit amount',

    editor: {
      component: NumberInputEditor,
      data: (cell) => ({
        initialValue: cell.value ?? null,
        config: { label: 'Amount', mode: 'number', validators: [Validators.min(0)] },
        save: (value) =>
          persistence.saveAmount({
            cell: identity(cell),
            data: { value },
            queryParams: { source: 'amount-column', include: ['totals', 'status'] },
          }),
      }),

      presentation: {
        kind: 'popover',
        options: ({ trigger }) => ({
          anchor: { kind: 'element', element: trigger },
          placement: 'bottom',
          width: 320,
        }),
      },
    },
  },
} satisfies EditCellParams<Row, number, InputEditorData<number>>;

export const textParams = {
  action: {
    editor: {
      component: TextInputEditor,
      data: (cell) => ({
        initialValue: cell.value ?? null,
        config: { label: 'Name', mode: 'text' },
        save: (value) => persistence.saveName({ cell: identity(cell), data: { value } }),
      }),
    },
  },
} satisfies EditCellParams<Row, string, InputEditorData<string>>;

export const textareaParams = {
  action: {
    editor: {
      component: TextareaEditor,
      data: (cell) => ({
        initialValue: cell.value ?? '',
        config: { label: 'Notes', rows: 4, maxLength: 2000 },
        save: (value) => persistence.saveNotes({ cell: identity(cell), data: { value } }),
      }),

      presentation: { kind: 'dialog', options: { width: 600, height: 'auto' } },
    },
  },
} satisfies EditCellParams<Row, string, TextareaEditorData>;

export const detailsParams = {
  action: {
    editor: {
      component: DetailsEditor,
      data: (cell) => {
        const origin = identity(cell);
        if (!cell.data) throw new Error('Missing row.');
        return {
          cell: origin,
          initialDraft: {
            description: cell.data.name,
            enabled: cell.data.enabled,
            revision: cell.data.metadata.revision,
          },
        };
      },

      presentation: { kind: 'dialog', options: { title: 'Details', width: 640 } },
    },
  },
} satisfies EditCellParams<Row, string, DetailsEditorData>;

export const toggleParams = {
  editable: { allowed: true },
  toggle: {
    save: (value, cell) => persistence.saveEnabled({ cell: identity(cell), data: { value } }),
  },
} satisfies ToggleCellParams<Row>;

export const dropdownParams = {
  dropdown: {
    options: [{ label: 'Kilograms', value: { code: 'kg' } }],
    equals: (left, right) => left.code === right.code,
    save: (value, cell) => persistence.saveUnit({ cell: identity(cell), data: { value } }),
  },
} satisfies DropdownCellParams<Row, Unit>;

// Composite cells reuse category params; they do not nest renderer instances.
export const toggleNumberParams = {
  ...amountParams,
  toggle: {
    checked: (cell) => cell.data?.enabled ?? false,
    save: (value, cell) => persistence.saveEnabled({ cell: identity(cell), data: { value } }),
  },
} satisfies EditCellParams<Row, number, InputEditorData<number>> & TogglePart<Row, number>;

declare const numberCell: CellContext<Row, number>;
declare const textCell: CellContext<Row, string>;
declare const unitCell: CellContext<Row, Unit>;
declare const trigger: HTMLElement;
declare const editorHost: EditorHostService;

export const context = { editorHost, currency: 'USD' } satisfies GridContext & {
  readonly currency: string;
};
export const displayOnlyContext = {} satisfies GridContext;

export const numberDefinition = {
  component: NumberInputEditor,
  data: amountParams.action.editor.data(numberCell),
} satisfies EditorDefinition<InputEditorData<number>>;

// One editor definition works in both presentations. There is no owner in the open call.
editorHost.open(numberDefinition, { kind: 'popover', options: { width: 320 } }, { trigger });
editorHost.open(numberDefinition, { kind: 'dialog', options: { width: 600 } }, { trigger });
editorHost.open(
  { component: DetailsEditor, data: detailsParams.action.editor.data(textCell) },
  { kind: 'dialog' },
  { trigger },
);
editorHost.open(
  {
    component: OptionsEditor,
    data: {
      initialValue: unitCell.value,
      options: dropdownParams.dropdown.options,
      equals: dropdownParams.dropdown.equals,
      save: (value) => dropdownParams.dropdown.save(value, unitCell),
    },
  },
  { kind: 'popover' },
  { trigger },
);

export const zeroData = { ...numberDefinition.data, initialValue: 0 };
export const emptyData = { ...numberDefinition.data, initialValue: null };

export async function saveNumber(
  data: InputEditorData<number>,
  value: number | null,
  ref: EditorRef,
) {
  await data.save(value);
  ref.close();
}

export async function saveDetails(data: DetailsEditorData, draft: DetailsEdit, ref: EditorRef) {
  await persistence.saveDetails({ cell: data.cell, data: draft });
  ref.close();
}

export async function approveDetails(data: DetailsEditorData, ref: EditorRef) {
  await persistence.approveDetails({
    cell: data.cell,
    data: { revision: data.initialDraft.revision },
    queryParams: { source: 'details-approval' },
  });
  ref.close();
}

// Feature-specific examples. These private fixture shapes are not shared kit adapters.
// Runtime sequencing, authorization, invalidation and rollback are implemented in phases 3–4.
declare const state: {
  getRow(id: string): Row | undefined;
  notifyMutation(): void;
  replaceRow(row: Row): void;
  replaceRows(rows: readonly Row[]): void;
};
declare const api: GridApi<Row>;
declare const backend: {
  saveAmount(
    payload: { readonly id: string; readonly amount: number | null },
    query: HttpQueryParams,
  ): Promise<{ readonly rows: readonly Row[] }>;
};

export async function saveAmountByMutation(command: EditCommand<AmountEdit>): Promise<void> {
  const row = state.getRow(command.cell.rowId);
  const node = api.getRowNode(command.cell.rowId);
  if (!row || !node || node.data !== row) throw new Error('Missing or unsynchronized row.');
  row.amount = command.data.value;
  row.metadata.amountEdited = true;
  state.notifyMutation();
  api.refreshCells({ rowNodes: [node], columns: ['amount'], force: true });
  api.refreshClientSideRowModel('group');
}

export async function saveAmountByTransaction(command: EditCommand<AmountEdit>): Promise<void> {
  const row = state.getRow(command.cell.rowId);
  if (!row) throw new Error('Missing row.');
  const updated: Row = {
    ...row,
    amount: command.data.value,
    metadata: { ...row.metadata, amountEdited: true },
  };
  const result = api.applyTransaction({ update: [updated] });
  if (!result?.update.length) throw new Error('The grid rejected the update.');
  state.replaceRow(updated);
  api.refreshCells({ rowNodes: result.update, columns: ['amount'], force: true });
}

export async function saveAmountToServer(command: EditCommand<AmountEdit>): Promise<void> {
  const row = state.getRow(command.cell.rowId);
  if (!row) throw new Error('Missing row.');
  const response = await backend.saveAmount(
    { id: row.id, amount: command.data.value },
    command.queryParams ?? {},
  );
  state.replaceRows(response.rows);
  api.setGridOption('rowData', [...response.rows]);
}

export const getRowId = ({ data }: { readonly data: Row }) => data.id;

// The editor contract has no mandatory dirty state or row-bearing session.
declare const dataInput: InputSignal<InputEditorData<number>>;
export const editorWithoutDirty = { data: dataInput } satisfies HostedEditor<
  InputEditorData<number>
>;
