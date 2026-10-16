import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('one small table covers every edit type and resets saved changes', async ({ page }) => {
  await page.goto('/grid-demo');
  await expect(page.getByRole('heading', { name: 'Cell editor showcase' })).toBeVisible();
  await expect(page.locator('ag-grid-angular')).toHaveCount(1);
  await expect(page.locator('.ag-row[row-id]')).toHaveCount(12);
  await expect(page.getByRole('region', { name: 'Group columns', exact: true })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: 'Middle mouse grouping' })).toHaveCount(0);
  await expect(page.locator('ag-grid-angular[appColumnDragGrouping]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Capture snapshot' })).toHaveCount(0);
  await expect(page.getByRole('tab')).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const cell = page.locator('.ag-row[row-id="row-00001"] [col-id="name"]');
  await cell.hover();
  await cell.locator('button').click();
  const editor = page.getByRole('dialog', { name: 'Edit material name' });
  await editor.getByLabel('Value', { exact: true }).fill('Simple showcase');
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(cell.locator('.grid-cell-content')).toHaveText('Simple showcase');
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await expect(cell.locator('.grid-cell-content')).toHaveText('Material 00001');
  await page.getByRole('link', { name: 'Standalone popover demo' }).click();
  await expect(page).toHaveURL(/popover-demo$/);
});

test('column grouping has its own plain table, layout reset and navigation to the cell demo', async ({
  page,
}) => {
  await page.goto('/column-group-demo');
  await expect(page.getByRole('heading', { name: 'Column grouping demo' })).toBeVisible();
  await expect(page.locator('ag-grid-angular')).toHaveCount(1);
  await expect(page.locator('.ag-row[row-id]')).toHaveCount(12);
  await expect(page.getByLabel('Persistence mode', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: 'Show units' })).toHaveCount(0);
  await expect(page.getByTestId('edit-pending')).toHaveCount(0);
  const name = page.locator('.ag-row[row-id="sample-01"] [col-id="name"]');
  await name.hover();
  await expect(name).toHaveText('Product 1');
  await expect(name.locator('button')).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByRole('button', { name: 'Group columns', exact: true }).click();
  await expect(
    page.locator('.ag-header-group-cell').filter({ has: page.locator('app-ungroup-header') }),
  ).toHaveCount(1);
  const id = page.locator('.ag-header-cell[col-id="id"]');
  await id.click();
  await expect(id).toHaveAttribute('aria-sort', 'ascending');
  const resize = await id.locator('.ag-header-cell-resize').boundingBox();
  if (!resize) throw new Error('Resize handle is missing');
  await page.mouse.move(resize.x + resize.width / 2, resize.y + resize.height / 2);
  await page.mouse.down();
  await page.mouse.move(resize.x + resize.width / 2 + 40, resize.y + resize.height / 2);
  await page.mouse.up();
  expect(await id.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(
    130,
  );
  await page.getByRole('button', { name: 'Reset column layout', exact: true }).click();
  await expect(page.locator('app-ungroup-header')).toHaveCount(0);
  await expect(id).toHaveAttribute('aria-sort', 'none');
  await expect(id).toHaveAttribute('aria-colindex', '1');
  expect(await id.evaluate((element) => element.getBoundingClientRect().width)).toBe(130);
  await page.getByRole('link', { name: 'Cell system demo', exact: true }).click();
  await expect(page).toHaveURL(/\/grid-demo$/);
  await expect(page.getByRole('heading', { name: 'Cell editor showcase' })).toBeVisible();
  await expect(page.locator('ag-grid-angular')).toHaveCount(1);
  await page.getByRole('link', { name: 'Column grouping demo', exact: true }).click();
  await expect(page).toHaveURL(/\/column-group-demo$/);
  await expect(page.locator('app-ungroup-header')).toHaveCount(0);
});
