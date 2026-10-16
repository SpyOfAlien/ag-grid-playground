import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function openPen(page: import('@playwright/test').Page, column: string, rowId = 'row-00001') {
  const cell = page.locator(`.ag-row[row-id="${rowId}"] [col-id="${column}"]`);
  await cell.hover();
  await cell.locator('button').click();
}

test('text popover validates, saves the correct row, and mounts editors only on activation', async ({
  page,
}) => {
  await page.goto('/grid-demo');
  await expect(page.getByRole('button', { name: 'Reset demo' })).toBeEnabled();
  await expect(
    page.locator('app-input-editor, app-textarea-editor, .cdk-overlay-pane'),
  ).toHaveCount(0);
  await openPen(page, 'name');
  const dialog = page.getByRole('dialog', { name: 'Edit material name' });
  const input = dialog.getByLabel('Value', { exact: true });
  await expect(input).toHaveValue('Material 00001');
  await expect(input).toBeFocused();
  await input.fill('');
  await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await input.blur();
  await expect(dialog.locator('mat-error')).toHaveText('Enter a valid value.');
  await input.fill('Edited in popover');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.locator('.ag-row[row-id="row-00001"] [col-id="name"] .grid-cell-content'),
  ).toHaveText('Edited in popover');
  await expect(
    page.locator('.ag-row[row-id="row-00002"] [col-id="name"] .grid-cell-content'),
  ).toHaveText('Material 00002');
  await expect(page.locator('app-input-editor, .cdk-overlay-pane')).toHaveCount(0);
});

test('number popover edits a raw number and formats grouping, decimals, units, and zero after save', async ({
  page,
}) => {
  await page.goto('/grid-demo');
  await openPen(page, 'metric-2');
  const dialog = page.getByRole('dialog', { name: 'Edit measurement' });
  const input = dialog.getByLabel('Value', { exact: true });
  await expect(input).toHaveAttribute('type', 'number');
  await input.fill('-1');
  await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await input.fill('1234.5');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  const content = page.locator(
    '.ag-row[row-id="row-00001"] [col-id="metric-2"] .grid-cell-content',
  );
  await expect(content).toHaveText('1,234.50 kg');
  await openPen(page, 'metric-2');
  await expect(input).toHaveValue('1234.5');
  await input.fill('0');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(content).toHaveText('0.00 kg');
});

test('textarea dialog owns validation and actions, cancels drafts, and saves multiline notes', async ({
  page,
}) => {
  await page.goto('/grid-demo');
  await openPen(page, 'notes');
  const dialog = page.getByRole('dialog', { name: 'Edit notes' });
  const textarea = dialog.getByLabel('Value', { exact: true });
  await expect(textarea).toHaveAttribute('rows', '5');
  await textarea.fill('Cancelled notes');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await openPen(page, 'notes');
  await expect(textarea).toHaveValue('');
  await textarea.fill('Line one\nLine two');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await openPen(page, 'notes');
  await expect(textarea).toHaveValue('Line one\nLine two');
  await page.keyboard.press('Escape');
});

test('disabled cells show their reason and permitted rows can open editors in server mode', async ({
  page,
}) => {
  await page.goto('/grid-demo');
  const cell = page.locator('.ag-row[row-id="row-00002"] [col-id="name"]');
  await cell.hover();
  const pen = cell.locator('button');
  await expect(pen).toHaveAttribute('aria-disabled', 'true');
  await expect(pen).toHaveAttribute('title', 'Review this row before editing');
  await pen.evaluate((element: HTMLButtonElement) => element.click());
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Persistence mode').selectOption('server');
  const allowedRowPen = page.locator('.ag-row[row-id="row-00001"] [col-id="name"] button');
  await expect(allowedRowPen).toHaveAttribute('aria-disabled', 'false');
  await allowedRowPen.evaluate((element: HTMLButtonElement) => element.click());
  await expect(page.getByRole('dialog', { name: 'Edit material name' })).toBeVisible();
  await page.keyboard.press('Escape');
});

for (const presentation of ['popover', 'dialog'] as const) {
  test(`${presentation} outside click discards an unsubmitted draft and releases the grid`, async ({
    page,
  }) => {
    await page.goto('/grid-demo');
    const column = presentation === 'popover' ? 'name' : 'notes';
    await openPen(page, column);
    const editor = page.getByRole('dialog');
    const input = editor.getByLabel('Value', { exact: true });
    const original = await input.inputValue();
    await input.fill('Unsubmitted outside-click draft');
    const backdrop = page.locator('.cdk-overlay-backdrop');
    await expect(backdrop).toBeVisible();
    if (presentation === 'popover')
      await expect(backdrop).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await backdrop.click({ position: { x: 2, y: 2 } });
    await expect(editor).toHaveCount(0);
    await expect(page.locator('ag-grid-angular')).not.toHaveAttribute('inert', '');
    await openPen(page, column);
    await expect(input).toHaveValue(original);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(editor).toHaveCount(0);
  });
}
