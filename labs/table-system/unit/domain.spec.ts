import { it, expect } from 'vitest';
import { OperationController } from '../../../src/app/shared/table-system/operations/operation-controller';
import { TableModel } from '../../../src/app/shared/table-system/model/table-model';
import { createDetailsOperation } from '../../../src/app/features/table-system-lab/domain/details-command';
import { fixtures, validateRow } from '../../../src/app/features/table-system-lab/domain/lab-row';
import { SimulatedServer } from '../../../src/app/features/table-system-lab/persistence/simulated-server';
it('multi-field approve normalizes and atomically updates the dependent row', async () => {
  const model = new TableModel('lab', fixtures(3), validateRow);
  const runtime = new OperationController(model);
  const server = new SimulatedServer();
  server.delay.set(0);
  const operation = createDetailsOperation(server, () => true);
  const before = model.rows();
  const pending = runtime.submit(
    operation,
    { entityId: 'item-0', operation: 'details' },
    {
      id: 'item-0',
      baseRevision: 0,
      action: 'approve',
      draft: { name: ' Revised ', amount: 7, note: 'draft' },
    },
  );
  expect(model.rows()).toBe(before);
  expect((await pending).kind).toBe('committed');
  expect(model.lookup('item-0')).toMatchObject({
    name: 'Revised',
    amount: 7,
    note: 'draft',
    reviewed: true,
    revision: 1,
  });
  expect(model.lookup('item-1')).toMatchObject({
    note: 'Dependent update from Revised',
    revision: 1,
  });
});
it('revalidates independent approval permission on submission', async () => {
  const model = new TableModel('lab', fixtures(3), validateRow);
  const runtime = new OperationController(model);
  const server = new SimulatedServer();
  let permission = true;
  const operation = createDetailsOperation(server, () => permission);
  permission = false;
  const result = await runtime.submit(
    operation,
    { entityId: 'item-0', operation: 'details' },
    {
      id: 'item-0',
      baseRevision: 0,
      action: 'approve',
      draft: { name: 'Revised', amount: 7, note: 'draft' },
    },
  );
  expect(result.kind).toBe('denied');
  expect(server.submissions()).toBe(0);
});
