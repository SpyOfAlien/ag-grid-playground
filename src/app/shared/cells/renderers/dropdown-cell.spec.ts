import { TestBed } from '@angular/core/testing';
import {
  FakePersistence,
  ITEM,
  rendererParams,
  settle,
  testSession,
  type Item,
} from '../testing/cell-test-kit';
import type { CellRule } from '../base/base';
import { DropdownCell, type DropdownCellParams } from './dropdown-cell';

const CATEGORIES: DropdownCellParams<Item, string, FakePersistence> = {
  options: [
    { value: 'hw', label: 'Hardware' },
    { value: 'tools', label: 'Tools' },
  ],
  placeholder: 'Choose category',
};

async function render(
  value: string | null,
  persistence = new FakePersistence(),
  config: { label?: CellRule<Item, string, string> } = {},
) {
  const session = testSession(persistence);
  await session.run('load', {});
  const fixture = TestBed.createComponent(DropdownCell<Item, string, FakePersistence>);
  fixture.componentInstance.agInit(
    rendererParams(session, { ...CATEGORIES, ...config }, value, {
      columnId: 'category',
      field: 'category',
      headerName: 'Category',
    }),
  );
  await fixture.whenStable();
  const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;
  return { fixture, persistence, button };
}

function option(label: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('.cells-options button')).find(
    (button) => button.textContent?.trim() === label,
  );
}

describe('DropdownCell', () => {
  afterEach(() =>
    document.querySelectorAll('.cdk-overlay-container').forEach((node) => node.remove()),
  );

  it('shows the selected label, or the placeholder when nothing matches', async () => {
    expect((await render('hw')).button.textContent?.trim()).toBe('Hardware');
    expect((await render('lb')).button.textContent?.trim()).toBe('Choose category');
    expect((await render(null)).button.textContent?.trim()).toBe('Choose category');
  });

  it('is named after its column and the choice, unless the column gives a label', async () => {
    expect((await render('hw')).button.getAttribute('aria-label')).toBe('Category: Hardware');
    expect((await render(null)).button.getAttribute('aria-label')).toBe(
      'Category: Choose category',
    );
    const custom = await render('hw', new FakePersistence(), {
      label: ({ row }) => `Category of ${row.sku}`,
    });
    expect(custom.button.getAttribute('aria-label')).toBe('Category of A-1');
  });

  it('opens the options and saves a different choice to its own field, then closes', async () => {
    const { button, fixture, persistence } = await render('hw');

    button.click();
    await fixture.whenStable();
    expect(option('Hardware')?.getAttribute('aria-current')).toBe('true');
    option('Tools')!.click();
    await settle(fixture);

    expect(persistence.saved).toEqual([
      {
        source: { rowId: 'A-1', columnId: 'category' },
        changes: [{ rowId: 'A-1', field: 'category', value: 'tools' }],
      },
    ]);
    expect(option('Tools')).toBeUndefined();
  });

  it('closes without saving when the current option is chosen again', async () => {
    const { button, fixture, persistence } = await render('hw');

    button.click();
    await fixture.whenStable();
    option('Hardware')!.click();
    await settle(fixture);

    expect(persistence.saved).toEqual([]);
    expect(option('Hardware')).toBeUndefined();
  });

  it('stays open with the error when the save fails', async () => {
    const persistence = new FakePersistence();
    persistence.next = () => Promise.reject(new Error('Category is retired'));
    const { button, fixture } = await render('hw', persistence);

    button.click();
    await fixture.whenStable();
    option('Tools')!.click();
    await settle(fixture);

    expect(option('Tools')).toBeDefined();
    expect(document.querySelector('.cells-options + [role="alert"]')?.textContent?.trim()).toBe(
      'Category is retired',
    );
  });
});
