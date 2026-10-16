import type { ToggleNumberCellParams } from '../src/app/features/grid-demo/cells/toggle-number/toggle-number-cell-params.model';
import { InputEditor } from '../src/app/shared/grid-cells/editing/editors/input/input-editor';
interface Row {
  amount: number | null;
  active: boolean;
}
const params = {
  content: {
    alignment: 'end',

    number: { decimals: 2, unit: 'kg' },
  },
  toggle: { checked: ({ data }) => data?.active ?? false, save: async () => undefined },
  action: {
    editor: {
      component: InputEditor<number>,
      data: (cell) => ({
        initialValue: cell.value ?? null,
        config: { label: 'Amount', mode: 'number' },
        save: async () => undefined,
      }),
    },
  },
} satisfies ToggleNumberCellParams<Row>;
const wrongEditor: ToggleNumberCellParams<Row> = {
  ...params,
  action: {
    editor: {
      // @ts-expect-error Text editor data cannot accept the numeric draft.
      component: InputEditor<string>,
      data: params.action.editor.data,
    },
  },
};
const unrelatedCategory: ToggleNumberCellParams<Row> = {
  ...params,
  // @ts-expect-error Composite params do not acquire unrelated dropdown settings.
  dropdown: { options: [] },
};
const wrongToggle: ToggleNumberCellParams<Row> = {
  ...params,
  toggle: {
    // @ts-expect-error Toggle saves accept boolean values even when the cell value is numeric.
    save: async (_value: number) => undefined,
  },
};
void [wrongEditor, unrelatedCategory, wrongToggle];
