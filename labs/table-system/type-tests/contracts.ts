import { NumberEditor } from '../../../src/app/shared/table-system/editors/number-editor';
import { defineColumn } from '../../../src/app/shared/table-system/ag-grid/typed-columns';
import { Operation } from '../../../src/app/shared/table-system/operations/operation-controller';
import { LabRow } from '../../../src/app/features/table-system-lab/domain/lab-row';
import { AmountCommand } from '../../../src/app/features/table-system-lab/domain/lab-operations';
import { EditorSessions } from '../../../src/app/shared/table-system/editors/editor-session';
declare const amount: Operation<LabRow, AmountCommand>;
declare const sessions: EditorSessions<LabRow>;
const column = defineColumn<LabRow>();
column({
  id: 'amount',
  header: 'Amount',
  value: (row) => row.amount,
  // @ts-expect-error a numeric value cannot use a string display strategy
  display: (value: string) => value,
});
column({
  id: 'amount',
  header: 'Amount',
  value: (row) => row.amount,
  display: (value) => String(value),
  interaction: {
    operation: amount,
    target: (row) => ({ entityId: row.id, operation: 'amount' }),
    // @ts-expect-error amount commands require numeric amounts
    command: (_value, row) => ({ id: row.id, amount: 'bad', baseRevision: row.revision }),
    permission: () => true,
    label: () => 'Amount',
  },
});
sessions.open(
  { rowId: 'row', columnId: 'amount' },
  'bad',
  amount,
  { entityId: 'row', operation: 'amount' },
  // @ts-expect-error editor draft does not match operation input
  (value) => ({ id: 'row', amount: value, baseRevision: 0 }),
);

column<string>({
  id: 'name',
  header: 'Name',
  value: (row) => row.name,
  display: (value) => String(value),
  // @ts-expect-error a numeric editor cannot edit a string column
  editor: { content: NumberEditor, presentation: 'popover' },
});
