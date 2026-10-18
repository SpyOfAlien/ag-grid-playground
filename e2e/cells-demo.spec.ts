import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

const main = (page: Page) => page.getByTestId('inventory-grid');
const summary = (page: Page) => page.getByTestId('summary-grid');
const cell = (page: Page, sku: string, column: string) =>
  main(page).locator(`.ag-row[row-id="${sku}"] [col-id="${column}"]`);

/** Hovers an element and checks the shared tooltip, then moves the pointer away. */
async function expectTooltip(page: Page, target: Locator, text: string): Promise<void> {
  // A click hides the tooltip; a fresh hover brings it back.
  await page.mouse.move(0, 0);
  await target.hover();
  await expect(page.locator('.cells-tooltip')).toHaveText(text);
  await page.mouse.move(0, 0);
  await expect(page.locator('.cells-tooltip')).toHaveCount(0);
}

test('loads the inventory into both grids with empty states and no axe violations', async ({
  page,
}) => {
  await page.goto('/cells-demo');

  await expect(page.getByRole('heading', { name: 'Warehouse inventory' })).toBeVisible();
  // 200 items plus the header row; only the visible rows are drawn.
  await expect(main(page).getByRole('grid')).toHaveAttribute('aria-rowcount', '201');
  await expect(summary(page).getByRole('grid')).toHaveAttribute('aria-rowcount', '201');
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
  ).toContainText('save · saved · SKU-01 qty · qty 120 → 200');
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
  await expectTooltip(page, active, 'Table is read-only');
  await active.click({ force: true });
  await expect(active).toHaveAttribute('aria-checked', 'false');
});

test('server failures keep committed values, report the error in a snackbar and allow retry', async ({
  page,
}) => {
  await page.goto('/cells-demo');
  await page.getByLabel('Persistence').selectOption('server');
  await page.getByRole('checkbox', { name: 'Fail next save' }).check();

  const active = cell(page, 'SKU-01', 'active').getByRole('switch');
  const otherControl = cell(page, 'SKU-02', 'category').getByRole('button');
  await active.click();
  await expect(otherControl).toHaveAttribute('aria-disabled', 'true');
  const snackbar = page.locator('mat-snack-bar-container');
  await expect(snackbar).toContainText('The server rejected this change.');
  await snackbar.getByRole('button', { name: 'Dismiss' }).click();
  await expect(snackbar).toHaveCount(0);
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
  await expectTooltip(page, pen, 'Approved items are locked');
  await expect(
    page.getByRole('list', { name: 'Edit history' }).getByRole('listitem').first(),
  ).toContainText('approve · saved');
});

test('changing the reorder level redraws the quantity marker that reads it', async ({ page }) => {
  await page.goto('/cells-demo');
  const marker = cell(page, 'SKU-01', 'qty').locator('.cells-marker[data-kind="error"]');
  await expect(cell(page, 'SKU-01', 'qty')).toHaveText('120 pcs');
  await expect(marker).toHaveCount(0);

  const setLevel = async (level: string) => {
    await cell(page, 'SKU-01', 'reorder')
      .getByRole('button', { name: 'Edit reorder level' })
      .click();
    const editor = page.getByRole('dialog', { name: 'Reorder level' });
    await editor.getByLabel('Reorder level').fill(level);
    await editor.getByRole('button', { name: 'Save' }).click();
    await expect(editor).toHaveCount(0);
  };

  await setLevel('200');
  await expect(marker).toHaveCount(1);
  await expectTooltip(page, marker, 'Below the reorder level of 200');

  await setLevel('50');
  await expect(marker).toHaveCount(0);
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

test('empty states line up with rendered values in the same column', async ({ page }) => {
  await page.goto('/cells-demo');
  await expect(cell(page, 'SKU-03', 'qty')).toHaveText('-');

  const emptyStateRight = await cell(page, 'SKU-03', 'qty').evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return range.getBoundingClientRect().right;
  });
  const renderedRight = await cell(page, 'SKU-02', 'qty')
    .locator('.cells-text')
    .evaluate((element) => element.getBoundingClientRect().right);

  expect(Math.abs(emptyStateRight - renderedRight)).toBeLessThan(2);
});

test('tooltips show on hover and keyboard focus, render HTML, and pass axe', async ({ page }) => {
  await page.goto('/cells-demo');
  // The tooltip is visual only (aria-hidden), like Material's.
  const tooltip = page.locator('.cells-tooltip');

  await cell(page, 'SKU-01', 'stockValue').locator('.cells-text').hover();
  await expect(tooltip).toHaveText('120 × 0.35 €');
  await expect(tooltip.locator('b')).toHaveText('120');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.mouse.move(0, 0);
  await expect(tooltip).toHaveCount(0);

  // Like Material, focus shows a tooltip only after keyboard input.
  await page.keyboard.press('Shift');
  await cell(page, 'SKU-01', 'active').getByRole('switch').focus();
  await expect(tooltip).toHaveText('Sold in the shop');
  await page.keyboard.press('Escape');
  await expect(tooltip).toHaveCount(0);
});

test('a column can place its tooltips on another side', async ({ page }) => {
  await page.goto('/cells-demo');
  const toggle = cell(page, 'SKU-03', 'active').getByRole('switch');

  await toggle.hover();
  const tooltip = page.locator('.cells-tooltip');
  await expect(tooltip).toBeVisible();

  const [trigger, tip] = [await toggle.boundingBox(), await tooltip.boundingBox()];
  expect(tip!.x).toBeGreaterThanOrEqual(trigger!.x + trigger!.width);
  expect(Math.abs(tip!.y + tip!.height / 2 - (trigger!.y + trigger!.height / 2))).toBeLessThan(4);
});

test('price, supplier and date columns edit, guard disabled options and flag overdue counts', async ({
  page,
}) => {
  await page.goto('/cells-demo');

  await cell(page, 'SKU-01', 'unitPrice').getByRole('button', { name: 'Edit Unit price' }).click();
  const price = page.getByRole('dialog', { name: 'Edit unit price' });
  await price.getByLabel('Unit price (€)').fill('1');
  await price.getByRole('button', { name: 'Save' }).click();
  await expect(cell(page, 'SKU-01', 'unitPrice')).toHaveText('1.00 €');
  await expect(cell(page, 'SKU-01', 'stockValue')).toHaveText('120.00 €');

  const supplier = cell(page, 'SKU-01', 'supplier').getByRole('button');
  await expect(supplier).toHaveText('Acme Industrial Supplies Ltd.');
  await supplier.click();
  const options = page.getByRole('group', { name: 'Options' });
  await expect(
    options.getByRole('button', { name: 'Legacy Parts (no new orders)' }),
  ).toBeDisabled();
  // Long labels are cut off with an ellipsis instead of scrolling the list sideways.
  const body = page.locator('.popover-body', { has: options });
  expect(await body.evaluate((element) => element.scrollWidth - element.clientWidth)).toBe(0);
  const acme = options.getByRole('button', { name: 'Acme Industrial Supplies Ltd.' });
  await expectTooltip(page, acme, 'Acme Industrial Supplies Ltd.');
  await options.getByRole('button', { name: 'FixIt Wholesale' }).click();
  await expect(supplier).toHaveText('FixIt Wholesale');

  await expect(cell(page, 'SKU-01', 'lastCounted')).toHaveText('01 Oct 2026');
  await expect(
    cell(page, 'SKU-10', 'lastCounted').locator('.cells-marker[data-kind="warning"]'),
  ).toHaveCount(1);
});

test('markers sit in the start padding and the pen appears at the end on hover or focus', async ({
  page,
}) => {
  await page.goto('/cells-demo');
  const box = async (locator: Locator) => (await locator.boundingBox())!;
  const name = (sku: string) => cell(page, sku, 'name');

  // SKU-04 has a marker, SKU-01 none: the text starts at the same place in both.
  const marked = await box(name('SKU-04').locator('.cells-marker'));
  const markedCell = await box(name('SKU-04'));
  expect(marked.x).toBeGreaterThanOrEqual(markedCell.x);
  expect(marked.x + marked.width).toBeLessThanOrEqual(markedCell.x + 16);
  const withMarker = await box(name('SKU-04').locator('.cells-text'));
  const without = await box(name('SKU-01').locator('.cells-text'));
  expect(Math.abs(withMarker.x - without.x)).toBeLessThan(1);

  // The pen is hidden until its cell is hovered, then sits at the cell's end.
  const qty = cell(page, 'SKU-01', 'qty');
  const pen = qty.getByRole('button', { name: 'Edit Quantity' });
  await page.mouse.move(0, 0);
  await expect(pen).toHaveCSS('opacity', '0');
  await qty.hover();
  await expect(pen).toHaveCSS('opacity', '1');
  const penBox = await box(pen);
  const qtyBox = await box(qty);
  expect(qtyBox.x + qtyBox.width - (penBox.x + penBox.width)).toBeLessThan(8);

  // Keyboard users see it once its cell has focus.
  await page.mouse.move(0, 0);
  await qty.click({ position: { x: 4, y: 4 } });
  await page.mouse.move(0, 0);
  await expect(pen).toHaveCSS('opacity', '1');
});
