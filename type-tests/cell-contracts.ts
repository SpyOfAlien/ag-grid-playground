import {
  BaseCell,
  InputEditor,
  type CellContext,
  type RendererParams,
  type TextCellParams,
  type NumberCellParams,
  type ToggleCellParams,
  type DropdownCellParams,
  type PopoverCellParams,
  type DialogCellParams,
  type InputEditorData,
  type CellRule,
} from '../src/app/shared/grid-cells/public-api';
import type { EditCommand } from '../src/app/shared/grid-cells/editing/edit-command.model';
import type { PopoverOptions } from '../src/app/shared/popover/popover.model';
interface Row {
  id: string;
  name: string;
  amount: number | null;
  active: boolean;
  status: 'draft' | 'approved';
}
const text = {
  content: { alignment: 'start', tooltip: ({ value }) => value ?? null },
  markers: { error: { when: ({ data }) => !data } },
} satisfies TextCellParams<Row>;
const number = {
  content: {
    number: { decimals: 2, useGrouping: true, unit: ({ data }) => (data?.active ? 'kg' : null) },
  },
} satisfies NumberCellParams<Row>;
const toggle = { toggle: { save: async () => undefined } } satisfies ToggleCellParams<Row>;
const dropdown = {
  dropdown: {
    options: [
      { value: 'draft', label: 'Draft' },
      { value: 'approved', label: 'Approved' },
    ],
    save: async () => undefined,
  },
} satisfies DropdownCellParams<Row, Row['status']>;
const popover = {
  action: {
    permission: ({ data }) =>
      data?.active ? { allowed: true } : { allowed: false, reason: 'Inactive' },

    editor: {
      component: InputEditor<number>,
      data: (cell) => ({
        initialValue: cell.value ?? null,
        config: { label: 'Amount', mode: 'number' },
        save: async () => undefined,
      }),

      popover: ({ trigger }) => ({
        anchor: { kind: 'element', element: trigger },
        placement: 'bottomLeft',
        width: 320,
      }),
    },
  },
  content: {
    number: { decimals: 2, unit: ({ data }) => (data?.active ? 'kg' : null) },
  },
} satisfies PopoverCellParams<Row, number, InputEditorData<number>>;
const dialog = {
  content: {
    number: popover.content.number,
  },
  action: {
    editor: {
      component: popover.action.editor.component,
      data: popover.action.editor.data,
      dialog: { width: '70vw', height: 400 },
    },
  },
} satisfies DialogCellParams<Row, number, InputEditorData<number>>;
const nullableNumberPopover = {
  content: {
    number: { decimals: 2, unit: ({ value }) => (value === 0 ? 'kg' : null) },
  },
  action: {
    editor: popover.action.editor,
  },
} satisfies PopoverCellParams<Row, number | null, InputEditorData<number>>;
const badTextPopover: PopoverCellParams<Row, string, InputEditorData<string>> = {
  content: {
    // @ts-expect-error Numeric formatting requires a numeric cell value.
    number: { unit: 'kg' },
  },
  action: {
    editor: {
      component: InputEditor<string>,
      data: () => ({
        initialValue: '',
        config: { label: 'Name', mode: 'text' },
        save: async () => undefined,
      }),
    },
  },
};
const badTextDialog: DialogCellParams<Row, string, InputEditorData<string>> = {
  content: {
    // @ts-expect-error Numeric formatting requires a numeric cell value.
    number: { decimals: 2 },
  },
  action: {
    editor: badTextPopover.action!.editor,
  },
};
const removedDisplay: PopoverCellParams<Row, number, InputEditorData<number>> = {
  // @ts-expect-error Custom text belongs in content.text.
  display: () => 'Amount',
  action: {
    editor: popover.action.editor,
  },
};
const displayOnlyPopover = {
  content: { number: { decimals: 2, unit: 'kg' } },
} satisfies PopoverCellParams<Row, number, InputEditorData<number>>;
const displayOnlyDialog = {
  content: { text: 'Amount' },
} satisfies DialogCellParams<Row, number, InputEditorData<number>>;
const oldTopLevelNumber: NumberCellParams<Row> = {
  // @ts-expect-error Numeric configuration belongs in content.number.
  number: { decimals: 2 },
};
const oldTopLevelEditor: PopoverCellParams<Row, number, InputEditorData<number>> = {
  // @ts-expect-error Editor configuration belongs in action.editor.
  editor: popover.action.editor,
};
const missingActionEditor: PopoverCellParams<Row, number, InputEditorData<number>> = {
  // @ts-expect-error A configured editing action requires its typed editor.
  action: { tooltip: 'Edit amount' },
};
const badTextNumber: TextCellParams<Row> = {
  content: {
    // @ts-expect-error Text cells cannot configure number formatting.
    number: number.content.number,
  },
};
const badTextDropdown: TextCellParams<Row> = {
  // @ts-expect-error Text cells cannot configure dropdowns.
  dropdown: dropdown.dropdown,
};
const badNumber: NumberCellParams<Row> = {
  // @ts-expect-error Number display cells cannot configure dropdowns.
  dropdown: dropdown.dropdown,
};
const badPopover: PopoverCellParams<Row, number, InputEditorData<number>> = {
  action: {
    // @ts-expect-error Popover editor config cannot use dialog options.
    editor: { ...popover.action.editor, dialog: { width: 300 } },
  },
};
const badDialog: DialogCellParams<Row, number, InputEditorData<number>> = {
  action: {
    // @ts-expect-error Dialog editor config cannot use popover options.
    editor: { ...popover.action.editor, popover: { placement: 'top' } },
  },
};
// @ts-expect-error Direct toggle configuration requires its save action.
const missingToggle: ToggleCellParams<Row> = { toggle: {} };
const badQuery: EditCommand<{ value: number }> = {
  cell: { rowId: 'one', columnId: 'amount' },
  data: { value: 5 },
  // @ts-expect-error Query values cannot contain nested objects.
  queryParams: { filter: { status: 'draft' } },
};
const escapeOptions: PopoverOptions = {
  // @ts-expect-error Escape cannot be disabled.
  disableClose: true,
};
const badPlacement: PopoverOptions = {
  // @ts-expect-error Placement must be one of the supported twelve values.
  placement: 'auto',
};
const constant: CellRule<Row, number, boolean> = true;
const callback: CellRule<Row, number, boolean> = ({ value }) => value === 0;
class ReadOnlyCell extends BaseCell<RendererParams<Row, number, NumberCellParams<Row>>> {
  check(): void {
    // @ts-expect-error Params are read-only in derived cells.
    this.params.set(null);
    // @ts-expect-error Only BaseCell owns its writable source.
    this.source.set(null);
  }
}
function readonlyRow(cell: CellContext<Row, number>): void {
  if (cell.data) {
    // @ts-expect-error Rules receive read-only rows.
    cell.data.amount = 5;
  }
}
void [
  displayOnlyPopover,
  displayOnlyDialog,
  oldTopLevelNumber,
  oldTopLevelEditor,
  missingActionEditor,
  nullableNumberPopover,
  badTextPopover,
  badTextDialog,
  removedDisplay,
  text,
  number,
  toggle,
  dropdown,
  popover,
  dialog,
  badTextNumber,
  badTextDropdown,
  badNumber,
  badPopover,
  badDialog,
  missingToggle,
  badQuery,
  escapeOptions,
  badPlacement,
  constant,
  callback,
  ReadOnlyCell,
  readonlyRow,
];
