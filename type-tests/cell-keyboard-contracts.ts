import { signal } from '@angular/core';
import type { ColDef, ColGroupDef } from 'ag-grid-community';
import {
  withCellKeyboard,
  withCellKeyboardColumns,
  type GridContext,
  type NumberCellParams,
} from '@grid-cells';
interface Row {
  id: string;
  amount: number;
}
const currency = signal('USD');
const params = {
  content: {
    number: { unit: () => currency() },
  },
} satisfies NumberCellParams<Row>;
const defaults = withCellKeyboard<Row>({ sortable: true });
const numeric = withCellKeyboard<Row, number>({
  field: 'amount',
  valueFormatter: ({ value }) => value?.toFixed(2) ?? '',
});
// @ts-expect-error Keyboard composition must not erase the numeric value contract.
numeric.valueGetter = () => 'invalid';
const columns: (ColDef<Row> | ColGroupDef<Row>)[] = withCellKeyboardColumns<Row>(
  [{ field: 'amount' }, { groupId: 'group', children: [{ field: 'id' }] }],
  defaults,
);
const displayOnly: GridContext = {};
// @ts-expect-error The editor host must satisfy the presentation service contract.
const invalidHost: GridContext = { editorHost: {} };
const invalidUnit = {
  content: {
    // @ts-expect-error Unit rules return a string or null, not an arbitrary value.
    number: { unit: () => 123 },
  },
} satisfies NumberCellParams<Row>;
// @ts-expect-error Column helpers retain the row field contract.
withCellKeyboardColumns<Row>([{ field: 'missing' }]);
void [params, columns, displayOnly, invalidHost, invalidUnit];
