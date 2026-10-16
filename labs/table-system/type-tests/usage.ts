import type { DestroyRef, Injector } from '@angular/core';
import {
  TableModel,
  OperationController,
  EditorSessions,
  TableProjection,
  TableEditorHost,
  TableInteractionContext,
  defineColumn,
  NumberEditor,
  computeNumber,
} from '../../../src/app/shared/table-system/public-api';
import {
  fixtures,
  LabRow,
  validateRow,
} from '../../../src/app/features/table-system-lab/domain/lab-row';
import {
  AmountCommand,
  createAmountOperation,
} from '../../../src/app/features/table-system-lab/domain/lab-operations';
import { SimulatedServer } from '../../../src/app/features/table-system-lab/persistence/simulated-server';
declare const injector: Injector;
declare const owner: DestroyRef;
declare const host: TableEditorHost;
const model = new TableModel('example', fixtures(2), validateRow);
const controller = new OperationController(model);
const sessions = new EditorSessions(controller);
const projection = new TableProjection(model);
const tableSystem: TableInteractionContext<LabRow> = {
  controller,
  sessions,
  host,
  injector,
  owner,
  focus: (address) => projection.focus(address.rowId, address.columnId),
  announceOpen: (_outcome) => {},
};
const amount = createAmountOperation(new SimulatedServer());
const column = defineColumn<LabRow>()<number | null, AmountCommand>({
  id: 'amount',
  header: 'Amount',
  value: (row) => row.amount,
  display: (value) => computeNumber(value, { decimals: 2, unit: 'kg' }),
  editor: { content: NumberEditor, presentation: 'popover' },
  interaction: {
    operation: amount,
    target: (row) => ({ entityId: row.id, operation: 'amount' }),
    command: (value, row) => ({ id: row.id, amount: value, baseRevision: row.revision }),
    permission: (row) => !row.locked,
    label: (row) => `Edit amount ${row.id}`,
  },
});
void tableSystem;
void column;
