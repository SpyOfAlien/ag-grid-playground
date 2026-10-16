import { test, expect } from '@playwright/test';
test('sorting, filtering, grouping and metadata follow committed state', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sort amount', exact: true }).click();
  await page.getByRole('button', { name: 'Change metadata', exact: true }).click();
  await expect(
    page.locator('tsys-text-cell').filter({ hasText: 'Item 0' }).first().locator('span').first(),
  ).toHaveAttribute('aria-label', /Metadata updated/);
  await page.getByRole('button', { name: 'Filter item 2', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit amount item-0', exact: true })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Clear filter', exact: true }).click();
  await page.getByRole('button', { name: 'Toggle grouping', exact: true }).click();
  await expect(page.locator('.ag-row-group .ag-group-value').first()).toContainText('parts');
  await expect(page.locator('.ag-row-group').getByRole('switch')).toHaveCount(0);
  await page.getByRole('button', { name: 'Toggle grouping', exact: true }).click();
  await page.getByRole('button', { name: 'Replace first row', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit amount item-0', exact: true })).toContainText(
    '88.00 kg',
  );
  await page.getByRole('button', { name: 'Remove first row', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit amount item-0', exact: true })).toHaveCount(
    0,
  );
});
test('disconnected grid reconstructs accepted business commits on reconnect', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Slow saves', exact: true }).click();
  await page.getByRole('switch', { name: 'Review item-0', exact: true }).first().click();
  await page.getByRole('button', { name: 'Toggle grid', exact: true }).click();
  await expect(page.getByRole('grid')).toHaveCount(0);
  await page.waitForTimeout(2700);
  await page.getByRole('button', { name: 'Toggle grid', exact: true }).click();
  await expect(
    page.getByRole('switch', { name: 'Review item-0', exact: true }).first(),
  ).toHaveAttribute('aria-checked', 'true');
});
