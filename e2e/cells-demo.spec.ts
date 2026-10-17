import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const main = (page: Page) => page.getByTestId('inventory-grid');
const summary = (page: Page) => page.getByTestId('summary-grid');
const cell = (page: Page, sku: string, column: string) =>
  main(page).locator(`.ag-row[row-id="${sku}"] [col-id="${column}"]`);

test('loads the inventory into both grids with placeholders and no axe violations', async ({
  page,
}) => {
  await page.goto('/cells-demo');

  await expect(page.getByRole('heading', { name: 'Warehouse inventory' })).toBeVisible();
  await expect(main(page).locator('.ag-row[row-id]')).toHaveCount(12);
  await expect(summary(page).locator('.ag-row[row-id]')).toHaveCount(12);
  await expect(cell(page, 'SKU-03', 'qty')).toHaveText('-');
  await expect(cell(page, 'SKU-04', 'qty')).toHaveText('NA');
  await expect(cell(page, 'SKU-01', 'qty')).toHaveText('120 pcs');
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
});

test('a popover edit saves through the session and updates dependent values in both grids', async ({
  page,
}) => {
  await page.goto('/cells-demo');
  const qty = cell(page, 'SKU-01', 'qty');
  await expect(qty).toHaveText('120 pcs');

  await qty.getByRole('button', { name: 'Edit Quantity' }).click();
  const editor = page.getByRole('dialog', { name: 'Edit quantity' });
  await editor.getByLabel('Quantity').fill('200');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect(editor).toHaveCount(0);
  await expect(qty).toHaveText('200 pcs');
  await expect(cell(page, 'SKU-01', 'stockValue')).toHaveText('70.00 €');
  await expect(summary(page).locator('.ag-row[row-id="SKU-01"] [col-id="stockValue"]')).toHaveText(
    '70.00 €',
  );
  await expect(
    page.getByRole('list', { name: 'Edit history' }).getByRole('listitem').first(),
  ).toContainText('save · saved · SKU-01 qty');
});

test('toggle and dropdown save directly, and a read-only lock disables every control', async ({
  page,
}) => {
  await page.goto('/cells-demo');
  const active = cell(page, 'SKU-01', 'active').getByRole('switch', { name: 'Active' });
  await expect(active).toHaveAttribute('aria-checked', 'true');
  await active.click();
  await expect(active).toHaveAttribute('aria-checked', 'false');

  const category = cell(page, 'SKU-06', 'category').getByRole('button');
  await expect(category).toHaveText('Choose category');
  await category.click();
  await page.getByRole('group', { name: 'Options' }).getByRole('button', { name: 'Tools' }).click();
  await expect(category).toHaveText('Tools');

  await page.getByRole('checkbox', { name: 'Read-only' }).check();
  await expect(active).toHaveAttribute('aria-disabled', 'true');
  await expect(active).toHaveAttribute('title', 'Table is read-only');
  await active.click({ force: true });
  await expect(active).toHaveAttribute('aria-checked', 'false');
});

test('server failures keep committed values, show the error on the cell and allow retry', async ({
  page,
}) => {
  await page.goto('/cells-demo');
  await page.getByLabel('Persistence').selectOption('server');
  await page.getByRole('checkbox', { name: 'Fail next save' }).check();

  const active = cell(page, 'SKU-01', 'active').getByRole('switch');
  const otherControl = cell(page, 'SKU-02', 'category').getByRole('button');
  await active.click();
  await expect(otherControl).toHaveAttribute('aria-disabled', 'true');
  await expect(active).toHaveAttribute('title', 'The server rejected this change.');
  await expect(active).toHaveAttribute('aria-checked', 'true');
  await expect(active).toHaveAttribute('aria-disabled', 'false');
  await expect(otherControl).toHaveAttribute('aria-disabled', 'false');

  await page.getByRole('checkbox', { name: 'Fail next save' }).check();
  await cell(page, 'SKU-02', 'qty').getByRole('button', { name: 'Edit Quantity' }).click();
  const editor = page.getByRole('dialog', { name: 'Edit quantity' });
  await editor.getByLabel('Quantity').fill('5');
  await editor.getByRole('button', { name: 'Save' }).click();
  await expect(editor.getByRole('alert')).toHaveText('The server rejected this change.');
  await editor.getByRole('button', { name: 'Save' }).click();
  await expect(editor).toHaveCount(0);
  await expect(cell(page, 'SKU-02', 'qty')).toHaveText('5 pcs');
  await expect(page.getByRole('list', { name: 'Edit history' })).toContainText('save · failed');
});

test('dialogs edit notes, several fields at once, and approve through another method', async ({
  page,
}) => {
  await page.goto('/cells-demo');

  await cell(page, 'SKU-01', 'notes').getByRole('button', { name: 'Edit Notes' }).click();
  const notes = page.getByRole('dialog', { name: 'Edit notes' });
  await notes.getByLabel('Notes').fill('Check supplier\nReorder in May');
  await notes.getByRole('button', { name: 'Save' }).click();
  await expect(notes).toHaveCount(0);
  await expect(cell(page, 'SKU-01', 'notes')).toContainText('Check supplier');

  const details = page.getByRole('dialog', { name: 'Item details' });
  await cell(page, 'SKU-02', 'details').getByRole('button', { name: 'Edit Details' }).click();
  await details.getByLabel('Name').fill('Wood screw XL');
  await details.getByLabel('Quantity').fill('10');
  await details.getByRole('button', { name: 'Save' }).click();
  await expect(details).toHaveCount(0);
  await expect(cell(page, 'SKU-02', 'name')).toHaveText('Wood screw XL');
  await expect(cell(page, 'SKU-02', 'qty')).toHaveText('10 pcs');

  await cell(page, 'SKU-02', 'details').getByRole('button', { name: 'Edit Details' }).click();
  await details.getByRole('button', { name: 'Approve' }).click();
  await expect(details).toHaveCount(0);
  await expect(cell(page, 'SKU-02', 'approved')).toHaveText('Approved');
  const pen = cell(page, 'SKU-02', 'qty').getByRole('button', { name: 'Edit Quantity' });
  await expect(pen).toHaveAttribute('aria-disabled', 'true');
  await expect(pen).toHaveAttribute('title', 'Approved items are locked');
  await expect(
    page.getByRole('list', { name: 'Edit history' }).getByRole('listitem').first(),
  ).toContainText('approve · saved');
});

test('a composite cell runs two controls with their own commands, by mouse and keyboard', async ({
  page,
}) => {
  await page.goto('/cells-demo');
  const reorder = cell(page, 'SKU-01', 'reorder');
  const toggle = reorder.getByRole('switch', { name: 'Reorder' });
  const pen = reorder.getByRole('button', { name: 'Edit reorder level' });
  await expect(reorder).toContainText('Reorder at 50');

  await pen.click();
  const editor = page.getByRole('dialog', { name: 'Reorder level' });
  await editor.getByLabel('Reorder level').fill('80');
  await editor.getByRole('button', { name: 'Save' }).click();
  await expect(reorder).toContainText('Reorder at 80');

  await reorder.click({ position: { x: 4, y: 4 } });
  await page.keyboard.press('Tab');
  await expect(toggle).toBeFocused();
  await page.keyboard.press(' ');
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await page.keyboard.press('Tab');
  await expect(pen).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(editor).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(editor).toHaveCount(0);
  await expect(pen).toBeFocused();
});

test('open options, popover and dialog editors have no axe violations', async ({ page }) => {
  await page.goto('/cells-demo');
  const axe = async () => (await new AxeBuilder({ page }).analyze()).violations;

  await cell(page, 'SKU-01', 'category').getByRole('button').click();
  await expect(page.getByRole('group', { name: 'Options' })).toBeVisible();
  expect(await axe()).toEqual([]);
  await page.keyboard.press('Escape');

  await cell(page, 'SKU-01', 'name').getByRole('button', { name: 'Edit Name' }).click();
  await expect(page.getByRole('dialog', { name: 'Edit name' })).toBeVisible();
  expect(await axe()).toEqual([]);
  await page.keyboard.press('Escape');

  await cell(page, 'SKU-01', 'details').getByRole('button', { name: 'Edit Details' }).click();
  await expect(page.getByRole('dialog', { name: 'Item details' })).toBeVisible();
  expect(await axe()).toEqual([]);
});

test('placeholders line up with rendered values in the same column', async ({ page }) => {
  await page.goto('/cells-demo');
  await expect(cell(page, 'SKU-03', 'qty')).toHaveText('-');

  const placeholderRight = await cell(page, 'SKU-03', 'qty').evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return range.getBoundingClientRect().right;
  });
  const renderedRight = await cell(page, 'SKU-02', 'qty')
    .locator('.cells-cell')
    .evaluate((element) => element.getBoundingClientRect().right);

  expect(Math.abs(placeholderRight - renderedRight)).toBeLessThan(2);
});
