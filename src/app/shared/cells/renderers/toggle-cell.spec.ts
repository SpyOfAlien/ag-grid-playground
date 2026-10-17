import { TestBed } from '@angular/core/testing';
import {
  FakePersistence,
  ITEM,
  rendererParams,
  settle,
  testSession,
  type Item,
} from '../testing/cell-test-kit';
import { ToggleCell, type ToggleCellParams } from './toggle-cell';

async function render<M extends string = 'save'>(
  config: ToggleCellParams<Item, FakePersistence, M>,
  persistence = new FakePersistence(),
  session = testSession(persistence),
) {
  await session.run('load', {});
  const fixture = TestBed.createComponent(ToggleCell<Item, FakePersistence, M>);
  fixture.componentInstance.agInit(
    rendererParams(session, config, ITEM.active, {
      columnId: 'active',
      field: 'active',
      headerName: 'Active',
    }),
  );
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;
  return { fixture, session, persistence, toggle: host.querySelector('button')! };
}

describe('ToggleCell', () => {
  it('shows the value as a switch and saves the opposite to its own field', async () => {
    const { toggle, persistence } = await render({});
    expect(toggle.getAttribute('role')).toBe('switch');
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(toggle.getAttribute('aria-label')).toBe('Active');

    toggle.click();

    expect(persistence.saved).toEqual([
      {
        source: { rowId: 'A-1', columnId: 'active' },
        changes: [{ rowId: 'A-1', field: 'active', value: false }],
      },
    ]);
  });

  it('disables with the lock reason first, then the editable reason', async () => {
    const { toggle, session, fixture, persistence } = await render({
      editable: ({ row }) => (row.locked ? true : 'Locked after review'),
      tooltip: 'Active in catalogue',
    });
    expect(toggle.getAttribute('aria-disabled')).toBe('true');
    expect(toggle.getAttribute('title')).toBe('Locked after review');

    session.lock('Table is read-only');
    await fixture.whenStable();
    expect(toggle.getAttribute('title')).toBe('Table is read-only');

    toggle.click();
    expect(persistence.saved).toEqual([]);
  });

  it('disables while saving and shows a failure on this cell until it saves again', async () => {
    const persistence = new FakePersistence();
    let fail!: (error: Error) => void;
    persistence.next = () => new Promise((_resolve, reject) => (fail = reject));
    const { toggle, fixture } = await render({ tooltip: 'Active in catalogue' }, persistence);

    toggle.click();
    await fixture.whenStable();
    expect(toggle.getAttribute('aria-disabled')).toBe('true');
    expect(toggle.getAttribute('title')).toBe('Active in catalogue');

    fail(new Error('Server rejected'));
    await settle(fixture);
    expect(toggle.getAttribute('aria-disabled')).toBe('false');
    expect(toggle.getAttribute('title')).toBe('Server rejected');

    persistence.next = () => Promise.resolve({ update: [] });
    toggle.click();
    await settle(fixture);
    expect(toggle.getAttribute('title')).toBe('Active in catalogue');
  });

  it('sends its own command to the method it names', async () => {
    const { toggle, persistence } = await render({
      method: 'approve',
      command: (next, cell) => ({ skus: [cell.rowId], params: { approved: next } }),
    });

    toggle.click();

    expect(persistence.saved).toEqual([]);
    expect(persistence.approved).toEqual([
      { skus: ['A-1'], params: { approved: false }, source: { rowId: 'A-1', columnId: 'active' } },
    ]);
  });

  it('fails at first render when the grid was not built with cellGridOptions', () => {
    const fixture = TestBed.createComponent(ToggleCell<Item, FakePersistence>);
    const params = { ...rendererParams(testSession(), {}, true), context: undefined };

    expect(() => fixture.componentInstance.agInit(params as never)).toThrow(
      'Cell renderers need a grid built with cellGridOptions().',
    );
  });
});
