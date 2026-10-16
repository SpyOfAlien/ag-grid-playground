// Compile-only feature actions use the production command and persistence contracts.
import type { EditCommand } from '@grid-cells';
import {
  DEMO_TABLE_PERSISTENCE,
  type DemoAmountEdit,
  type DemoDetailsEdit,
  type DemoTablePersistence,
} from '../../src/app/features/grid-demo/demo-persistence.model';
import { provideDemoServerEditing } from '../../src/app/features/grid-demo/demo-editing-providers';
import type { DemoServerPersistence } from '../../src/app/features/grid-demo/demo-server-persistence';

declare const feature: DemoTablePersistence;
declare const server: DemoServerPersistence;

const amount = {
  cell: { rowId: 'row-00001', columnId: 'metric-2' },
  data: { value: null },
  queryParams: { include: ['totals', 'status'] },
} satisfies EditCommand<DemoAmountEdit>;
const details = {
  cell: { rowId: 'row-00001', columnId: 'details' },
  data: { name: 'Material', amount: 0, notes: '', revision: 0 },
} satisfies EditCommand<DemoDetailsEdit>;

const amountSaved: Promise<void> = feature.saveAmount(amount);
const detailsSaved: Promise<void> = feature.saveDetails(details);
const approved: Promise<void> = feature.approveDetails(details);
const implementation: DemoTablePersistence = server;
const providers = provideDemoServerEditing();

// @ts-expect-error Details require their own draft and revision, not scalar amount data.
feature.saveDetails(amount);
// @ts-expect-error Numeric edit actions cannot carry a string.
feature.saveAmount({ cell: amount.cell, data: { value: '12' } });
// @ts-expect-error The demo details revision token is numeric.
feature.approveDetails({ cell: details.cell, data: { ...details.data, revision: 'old' } });
// @ts-expect-error Completion feedback does not retain the complete returned dataset.
feature.completion()?.rows;

void [amountSaved, detailsSaved, approved, implementation, providers, DEMO_TABLE_PERSISTENCE];
