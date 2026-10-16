import { describe, it, expect } from 'vitest';
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
function setup() {
  const model = new TableModel('test', fixtures(4), validateRow);
  const controller = new OperationController(model);
  const resolvers: (() => void)[] = [];
  const operation: Operation<
    LabRow,
    { id: string; revision?: number; table?: boolean; fail?: boolean }
  > = {
    name: 'test',
    scope: (c) => (c.table ? { kind: 'table' } : { kind: 'entity', id: c.id }),
    authorize: () => true,
    validate: () => {},
    execute: (c) =>
      new Promise((resolve, reject) =>
        resolvers.push(() =>
          c.fail
            ? reject(new Error('failed'))
            : resolve({
                kind: 'patch',
                rows: [{ id: c.id, expectedRevision: c.revision, changes: { reviewed: true } }],
              }),
        ),
      ),
  };
  return {
    model,
    controller,
    operation,
    resolvers,
    target: (id: string) => ({ entityId: id, operation: 'test' }),
  };
}
describe('committed model', () => {
  it('rejects a whole invalid batch without mutation', () => {
    const { model } = setup();
    const before = model.rows();
    expect(() =>
      model.commit({
        kind: 'patch',
        rows: [
          { id: 'item-0', changes: { reviewed: true } },
          { id: 'item-1', changes: { amount: NaN } },
        ],
      }),
    ).toThrow();
    expect(model.rows()).toBe(before);
  });
  it('rejects unknown identities and revision conflicts', () => {
    const { model } = setup();
    expect(() => model.commit({ kind: 'patch', rows: [{ id: 'missing', changes: {} }] })).toThrow();
    expect(() =>
      model.commit({ kind: 'patch', rows: [{ id: 'item-0', expectedRevision: 7, changes: {} }] }),
    ).toThrow('Revision conflict');
  });
  it('does not advance generation on commits', () => {
    const { model } = setup();
    const g = model.dataset().generation;
    model.commit({ kind: 'replace', rows: fixtures(2) });
    expect(model.dataset().generation).toBe(g);
    model.reset('new', fixtures(1));
    expect(model.dataset().generation).toBe(g + 1);
  });
});
describe('operation controller', () => {
  it('acquires synchronously, shares target status, allows independent scopes and excludes table scopes', async () => {
    const s = setup();
    const a = s.controller.observe(s.target('item-0'));
    const b = s.controller.observe(s.target('item-0'));
    const first = s.controller.submit(s.operation, s.target('item-0'), { id: 'item-0' });
    expect(a.status()).toEqual(b.status());
    a.release();
    expect(b.status().kind).toBe('pending');
    expect(await s.controller.submit(s.operation, s.target('item-0'), { id: 'item-0' })).toEqual({
      kind: 'busy',
    });
    const second = s.controller.submit(s.operation, s.target('item-1'), { id: 'item-1' });
    expect(
      await s.controller.submit(s.operation, s.target('item-2'), { id: 'item-2', table: true }),
    ).toEqual({ kind: 'busy' });
    s.resolvers.forEach((r) => r());
    expect((await first).kind).toBe('committed');
    expect((await second).kind).toBe('committed');
    b.release();
  });
  it('failure preserves committed state and persists after view recreation', async () => {
    const s = setup();
    const before = s.model.rows();
    const pending = s.controller.submit(s.operation, s.target('item-0'), {
      id: 'item-0',
      fail: true,
    });
    s.resolvers[0]();
    expect((await pending).kind).toBe('failed');
    expect(s.model.rows()).toBe(before);
    const view = s.controller.observe(s.target('item-0'));
    expect(view.status().kind).toBe('failed');
    view.release();
    s.controller.dismiss(s.target('item-0'));
    expect(s.controller.status(s.target('item-0')).kind).toBe('idle');
  });
  it('old response cannot commit after reset or destruction', async () => {
    const s = setup();
    const pending = s.controller.submit(s.operation, s.target('item-0'), { id: 'item-0' });
    s.model.reset('other', fixtures(4));
    s.resolvers[0]();
    expect((await pending).kind).toBe('stale');
    expect(s.model.lookup('item-0')?.reviewed).toBe(false);
    const next = s.controller.submit(s.operation, s.target('item-1'), { id: 'item-1' });
    s.controller.destroy();
    s.resolvers[1]();
    expect((await next).kind).toBe('stale');
  });
  it('revision conflicts produce actionable feedback', async () => {
    const s = setup();
    const pending = s.controller.submit(s.operation, s.target('item-0'), {
      id: 'item-0',
      revision: 9,
    });
    s.resolvers[0]();
    expect(await pending).toMatchObject({ kind: 'failed', conflict: true });
  });
});
it('a duplicate invalid command cannot overwrite a target pending status', async () => {
  const s = setup();
  const observed = s.controller.observe(s.target('item-0'));
  const first = s.controller.submit(s.operation, s.target('item-0'), { id: 'item-0' });
  const invalid = {
    ...s.operation,
    validate: () => {
      throw new Error('invalid duplicate');
    },
  };
  expect((await s.controller.submit(invalid, s.target('item-0'), { id: 'item-0' })).kind).toBe(
    'busy',
  );
  expect(observed.status().kind).toBe('pending');
  s.resolvers[0]();
  await first;
  observed.release();
});
it('unobserved validation failures have bounded retention', async () => {
  const s = setup();
  const invalid = {
    ...s.operation,
    validate: () => {
      throw new Error('invalid');
    },
  };
  for (let i = 0; i < 300; i++)
    await s.controller.submit(invalid, s.target(`entity-${i}`), { id: `entity-${i}` });
  expect(s.controller.status(s.target('entity-0')).kind).toBe('idle');
  expect(s.controller.status(s.target('entity-299')).kind).toBe('failed');
});
it('keeps unaffected immutable row identities and indexed lookup current', () => {
  const s = setup();
  const untouched = s.model.lookup('item-1');
  s.model.commit({ kind: 'patch', rows: [{ id: 'item-0', changes: { amount: 71 } }] });
  expect(s.model.lookup('item-1')).toBe(untouched);
  expect(s.model.lookup('item-0')?.amount).toBe(71);
});
