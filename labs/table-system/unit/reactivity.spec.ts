import { computed } from '@angular/core';
import { it, expect } from 'vitest';
import { TableModel } from '../../../src/app/shared/table-system/model/table-model';
import {
  OperationController,
  Operation,
} from '../../../src/app/shared/table-system/operations/operation-controller';
import {
  fixtures,
  LabRow,
  validateRow,
} from '../../../src/app/features/table-system-lab/domain/lab-row';
it('an unrelated pending target does not recompute an observed target status', async () => {
  const model = new TableModel('lab', fixtures(2), validateRow);
  const runtime = new OperationController(model);
  const target = { entityId: 'item-1', operation: 'test' };
  const view = runtime.observe(target);
  let evaluations = 0;
  const derived = computed(() => {
    evaluations++;
    return view.status().kind;
  });
  let finish!: () => void;
  const operation: Operation<LabRow, string> = {
    name: 'test',
    scope: (id) => ({ kind: 'entity', id }),
    authorize: () => true,
    validate: () => {},
    execute: (id) =>
      new Promise((resolve) => {
        finish = () => resolve({ kind: 'patch', rows: [{ id, changes: { reviewed: true } }] });
      }),
  };
  expect(derived()).toBe('idle');
  const pending = runtime.submit(operation, { entityId: 'item-0', operation: 'test' }, 'item-0');
  expect(derived()).toBe('idle');
  expect(evaluations).toBe(1);
  finish();
  await pending;
  expect(derived()).toBe('idle');
  expect(evaluations).toBe(1);
  view.release();
});
