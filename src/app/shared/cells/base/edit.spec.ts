import { cellSession } from '../grid/cell-grid-options';
import { FakePersistence, ITEM, testSession } from '../testing/cell-test-kit';
import { runCommand } from './edit';

describe('runCommand', () => {
  const cell = { rowId: 'A-1', columnId: 'state', row: ITEM, value: true };

  it('saves to the column’s own field when there is no command', async () => {
    const persistence = new FakePersistence();
    const session = testSession(persistence);
    await session.run({ method: 'load' });
    const target = { context: { session: cellSession(session) }, colDef: { field: 'active' } };

    await runCommand(target, undefined, { ...cell, columnId: 'active' }, false);

    expect(persistence.saved).toEqual([
      {
        changes: [{ rowId: 'A-1', field: 'active', value: false }],
      },
    ]);
    expect(session.entries().at(-1)?.command).toEqual({
      method: 'save',
      payload: { changes: [{ rowId: 'A-1', field: 'active', value: false }] },
      source: { rowId: 'A-1', columnId: 'active' },
    });
  });

  it('explains what is missing when the column has no top-level field', () => {
    const target = { context: { session: cellSession(testSession()) }, colDef: { field: 'a.b' } };

    expect(() => runCommand(target, undefined, cell, false)).toThrow(
      'Column state has no top-level field to save to; give its action a command.',
    );
  });
});
