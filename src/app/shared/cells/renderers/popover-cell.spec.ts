import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { CellEditor, EditorData } from '../editors/editor';
import {
  FakePersistence,
  ITEM,
  rendererParams,
  settle,
  testSession,
  tooltipFor,
  type Item,
} from '../testing/cell-test-kit';
import { PopoverCell, type PopoverCellParams } from './popover-cell';

type NameData = EditorData<Item, string> & { readonly hint: string };

@Component({
  selector: 'cells-test-name-editor',
  template: `
    <p class="probe">{{ data().value }} / {{ data().row.sku }} / {{ data().hint }}</p>
    <button type="button" class="probe-save" (click)="data().submit('Hex bolt')">Save</button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class NameEditor implements CellEditor<NameData> {
  readonly data = input.required<NameData>();
}

const NAME: PopoverCellParams<NameData, FakePersistence> = {
  action: {
    editor: { component: NameEditor, data: (cell) => ({ hint: `max 60 for ${cell.columnId}` }) },
    popover: { title: 'Edit name' },
  },
};

async function render(config = NAME, persistence = new FakePersistence()) {
  const session = testSession(persistence);
  await session.run('load', {});
  const fixture = TestBed.createComponent(PopoverCell<NameData, FakePersistence>);
  fixture.componentInstance.agInit(
    rendererParams(session, config, ITEM.name, {
      columnId: 'name',
      field: 'name',
      headerName: 'Name',
    }),
  );
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    persistence,
    session,
    host,
    pen: host.querySelector<HTMLButtonElement>('button.cells-pen')!,
  };
}

describe('PopoverCell', () => {
  afterEach(() =>
    document.querySelectorAll('.cdk-overlay-container').forEach((node) => node.remove()),
  );

  it('opens the editor from a named pen and saves what it submits', async () => {
    const { fixture, persistence, host, pen } = await render();
    expect(host.querySelector('.cells-text')?.textContent).toBe('Bolt');
    expect(pen.getAttribute('aria-label')).toBe('Edit Name');

    pen.click();
    await fixture.whenStable();
    expect(document.querySelector('.probe')?.textContent).toBe('Bolt / A-1 / max 60 for name');
    document.querySelector<HTMLButtonElement>('.probe-save')!.click();
    await settle(fixture);

    expect(persistence.saved).toEqual([
      {
        source: { rowId: 'A-1', columnId: 'name' },
        changes: [{ rowId: 'A-1', field: 'name', value: 'Hex bolt' }],
      },
    ]);
    expect(document.querySelector('.probe')).toBeNull();
  });

  it('phrases its name as an edit, with a hint that a status replaces', async () => {
    const { pen, session, fixture } = await render({
      ...NAME,
      action: { ...NAME.action, label: 'item name', tooltip: 'Rename this item' },
    });
    expect(pen.getAttribute('aria-label')).toBe('Edit item name');
    expect(tooltipFor(pen)).toBe('Rename this item');

    session.lock('Table is read-only');
    await fixture.whenStable();
    expect(tooltipFor(pen)).toBe('Table is read-only');
  });

  it('does not open while the cell is not editable', async () => {
    const { fixture, pen } = await render({
      ...NAME,
      action: { ...NAME.action, allowed: 'Locked after review' },
    });
    expect(pen.getAttribute('aria-disabled')).toBe('true');
    expect(tooltipFor(pen)).toBe('Locked after review');

    pen.click();
    await fixture.whenStable();

    expect(document.querySelector('.probe')).toBeNull();
  });
});
