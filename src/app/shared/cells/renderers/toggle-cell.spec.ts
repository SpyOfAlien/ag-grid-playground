import { TestBed } from '@angular/core/testing';
import {
  FakePersistence,
  ITEM,
  rendererParams,
  settle,
  testSession,
  tooltipFor,
  type Item,
} from '../testing/cell-test-kit';
import { ToggleCell, type ToggleCellParams } from './toggle-cell';

async function render(
  config: ToggleCellParams<Item, FakePersistence>,
  persistence = new FakePersistence(),
  session = testSession(persistence),
) {
  await session.run('load', {});
  const fixture = TestBed.createComponent(ToggleCell<Item, FakePersistence>);
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
  it('takes its accessible name from a label rule when the column gives one', async () => {
    const { toggle } = await render({ action: { label: ({ row }) => `Active: ${row.sku}` } });
    expect(toggle.getAttribute('aria-label')).toBe('Active: A-1');
  });

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

  it('disables with the lock reason first, then the allowed reason', async () => {
    const { toggle, session, fixture, persistence } = await render({
      action: {
        allowed: ({ row }) => (row.locked ? true : 'Locked after review'),
        tooltip: 'Active in catalogue',
      },
    });
    expect(toggle.getAttribute('aria-disabled')).toBe('true');
    expect(tooltipFor(toggle)).toBe('Locked after review');

    session.lock('Table is read-only');
    await fixture.whenStable();
    expect(tooltipFor(toggle)).toBe('Table is read-only');

    toggle.click();
    expect(persistence.saved).toEqual([]);
  });

  it('disables while saving and, after a failure, keeps its value and is usable again', async () => {
    const persistence = new FakePersistence();
    let fail!: (error: Error) => void;
    persistence.next = () => new Promise((_resolve, reject) => (fail = reject));
    const { toggle, fixture, session } = await render(
      { action: { tooltip: 'Active in catalogue' } },
      persistence,
    );

    toggle.click();
    await fixture.whenStable();
    expect(toggle.getAttribute('aria-disabled')).toBe('true');
    expect(tooltipFor(toggle)).toBe('Active in catalogue');

    fail(new Error('Server rejected'));
    await settle(fixture);
    expect(toggle.getAttribute('aria-disabled')).toBe('false');
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(tooltipFor(toggle)).toBe('Active in catalogue');
    expect(session.entries().at(-1)?.error).toBe('Server rejected');
  });

  it('sends its own command to the method it names', async () => {
    const { toggle, persistence } = await render({
      action: {
        submit: {
          method: 'approve',
          command: (next, cell) => ({ skus: [cell.rowId], params: { approved: next } }),
        },
      },
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
