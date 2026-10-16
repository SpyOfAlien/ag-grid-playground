import type { ColDef } from 'ag-grid-community';
import {
  bindCellRenderer,
  NumberCell,
  ToggleCell,
  DropdownCell,
  EditCell,
  InputEditor,
  type InputEditorData,
} from '@grid-cells';
import { ToggleNumberCell } from '../src/app/features/grid-demo/cells/toggle-number/toggle-number-cell';

interface Row {
  amount: number;
  unit: 'kg' | 'lb';
}

const number = bindCellRenderer(NumberCell<Row>, {
  content: { number: { unit: ({ data }) => data?.unit ?? null } },
});
const column: ColDef<Row, number> = { field: 'amount', ...number };
const dropdown = bindCellRenderer(DropdownCell<Row, Row['unit']>, {
  dropdown: {
    options: [{ value: 'kg', label: 'Kilograms' }],
    save: async (value, cell) => {
      const unit: Row['unit'] = value;
      const row: Readonly<Row> | undefined = cell.data;
      void [unit, row];
    },
  },
});
const popover = bindCellRenderer(EditCell<Row, number, InputEditorData<number>>, {
  action: {
    editor: {
      component: InputEditor<number>,
      data: ({ value }) => ({
        initialValue: value ?? null,
        config: { label: 'Amount', mode: 'number' },
        save: async () => undefined,
      }),
    },
  },
});
const composite = bindCellRenderer(ToggleNumberCell<Row, InputEditorData<number>>, {
  toggle: { checked: ({ value }) => value === 0, save: async () => undefined },
});

// @ts-expect-error The component fixes the config; inference must not accept a missing save.
bindCellRenderer(ToggleCell<Row>, {});
bindCellRenderer(NumberCell<Row>, {
  // @ts-expect-error A number renderer does not support a toggle configuration.
  toggle: { save: async () => undefined },
});
bindCellRenderer(NumberCell<Row>, {
  content: {
    // @ts-expect-error Rule values remain numeric, even without a separate satisfies clause.
    text: ({ value }) => value?.toUpperCase() ?? '',
  },
});
bindCellRenderer(DropdownCell<Row, Row['unit']>, {
  dropdown: {
    // @ts-expect-error Options must match the renderer's value type.
    options: [{ value: 'tonne', label: 'Tonnes' }],
    save: async () => undefined,
  },
});
bindCellRenderer(EditCell<Row, number, InputEditorData<number>>, {
  action: {
    editor: {
      // @ts-expect-error The editor must accept the declared opening data.
      component: InputEditor<string>,
      data: popover.cellRendererParams.action!.editor.data,
    },
  },
});
void [column, dropdown, composite];
