import { cellSession } from '../grid/cell-grid-options';
import { FakePersistence, ITEM, testSession } from '../testing/cell-test-kit';
import { submitEdit } from './edit';

describe('submitEdit', () => {
  const cell = { rowId: 'A-1', columnId: 'state', row: ITEM, value: true };

  it('saves to the column’s own field when there is no submit', async () => {
    const persistence = new FakePersistence();
    const session = testSession(persistence);
    await session.run('load', {});
    const target = { context: { session: cellSession(session) }, colDef: { field: 'active' } };

    await submitEdit(target, undefined, { ...cell, columnId: 'active' }, false);

    expect(persistence.saved).toEqual([
      {
        source: { rowId: 'A-1', columnId: 'active' },
        changes: [{ rowId: 'A-1', field: 'active', value: false }],
      },
    ]);
  });

  it('explains what is missing when the column has no top-level field', () => {
    const target = { context: { session: cellSession(testSession()) }, colDef: { field: 'a.b' } };

    expect(() => submitEdit(target, undefined, cell, false)).toThrow(
      'Column state has no top-level field to save to; give its action a submit.',
    );
  });
});
