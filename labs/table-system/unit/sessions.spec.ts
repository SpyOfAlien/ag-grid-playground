import { expect, it } from 'vitest';
import { EditorSessions } from '../../../src/app/shared/table-system/editors/editor-session';
import {
  OperationController,
  Operation,
} from '../../../src/app/shared/table-system/operations/operation-controller';
import { TableModel, TableUpdate } from '../../../src/app/shared/table-system/model/table-model';
import {
  fixtures,
  LabRow,
  validateRow,
} from '../../../src/app/features/table-system-lab/domain/lab-row';
it('captures initial drafts, rejects replacement and old completions cannot close newer sessions', async () => {
  const model = new TableModel('lab', fixtures(2), validateRow);
  const controller = new OperationController(model);
  const sessions = new EditorSessions(controller);
  let resolve!: (update: TableUpdate<LabRow>) => void;
  const operation: Operation<LabRow, number> = {
    name: 'amount',
    scope: () => ({ kind: 'entity', id: 'item-0' }),
    authorize: () => true,
    validate: () => {},
    execute: () => new Promise((r) => (resolve = r)),
  };
  const open = () =>
    sessions.open(
      { rowId: 'item-0', columnId: 'amount' },
      0,
      operation,
      { entityId: 'item-0', operation: 'amount' },
      (value) => value,
    );
  const first = open();
  if (first.kind !== 'opened') throw new Error();
  expect(open().kind).toBe('already-open');
  const submitted = first.session.save(5);
  first.session.close();
  const newer = open();
  if (newer.kind !== 'opened') throw new Error();
  resolve({ kind: 'patch', rows: [{ id: 'item-0', changes: { amount: 5 } }] });
  expect((await submitted).kind).toBe('committed');
  expect(sessions.active()?.id).toBe(newer.session.id);
  expect(model.lookup('item-0')?.amount).toBe(5);
  sessions.destroy();
  expect(sessions.active()).toBe(null);
});
it('obsolete unsubmitted drafts cannot target a reset dataset', async () => {
  const model = new TableModel('lab', fixtures(2), validateRow);
  const controller = new OperationController(model);
  const sessions = new EditorSessions(controller);
  const operation: Operation<LabRow, number> = {
    name: 'amount',
    scope: () => ({ kind: 'entity', id: 'item-0' }),
    authorize: () => true,
    validate: () => {},
    execute: async (value) => ({
      kind: 'patch',
      rows: [{ id: 'item-0', changes: { amount: value } }],
    }),
  };
  const opened = sessions.open(
    { rowId: 'item-0', columnId: 'amount' },
    0,
    operation,
    { entityId: 'item-0', operation: 'amount' },
    (value) => value,
  );
  if (opened.kind !== 'opened') throw new Error();
  model.reset('next', fixtures(2));
  expect((await opened.session.save(99)).kind).toBe('stale');
  expect(model.lookup('item-0')?.amount).toBe(0);
  expect(sessions.active()).toBeNull();
});
