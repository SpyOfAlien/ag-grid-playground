import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
async function check(page: import('@playwright/test').Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(result.violations).toEqual([]);
}
test('table and every available editor state pass AXE', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('grid')).toBeVisible();
  await check(page);
  mkdirSync('verification', { recursive: true });
  await page.screenshot({ path: resolve('verification/table.png') });
  await page.getByRole('button', { name: 'Edit amount item-0', exact: true }).click();
  await check(page);
  await page.keyboard.press('Escape');
  for (const name of [
    'Amount dialog',
    'Edit name',
    'Edit notes',
    'Edit category',
    'Edit details',
  ]) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await check(page);
    if (name === 'Edit details')
      await page.screenshot({ path: resolve('verification/details-editor.png') });
    await page.keyboard.press('Escape');
  }
  await page.getByRole('button', { name: 'Toggle grouping', exact: true }).click();
  await check(page);
});
test('keyboard focus stays trapped, has a visible outline and restores to connected trigger', async ({
  page,
}) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Edit amount item-0', exact: true });
  await trigger.click();
  const amount = page.getByRole('spinbutton', { name: 'Amount in kg' });
  await expect(amount).toBeFocused();
  await page.keyboard.press('Tab');
  const save = page.getByRole('button', { name: 'Save amount', exact: true });
  await expect(save).toBeFocused();
  mkdirSync('verification', { recursive: true });
  await page.screenshot({ path: resolve('verification/focus.png') });
  const outline = await save.evaluate((element) => getComputedStyle(element).outlineWidth);
  expect(parseFloat(outline)).toBeGreaterThanOrEqual(3);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(amount).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});
test('invalid, pending and failed numeric editor states pass AXE', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Slow saves', exact: true }).click();
  await page.getByRole('button', { name: 'Fail next save', exact: true }).click();
  await page.getByRole('button', { name: 'Edit amount item-0', exact: true }).click();
  const amount = page.getByRole('spinbutton', { name: 'Amount in kg' });
  await amount.fill('-1');
  await page.getByRole('button', { name: 'Save amount', exact: true }).click();
  await expect(amount).toHaveAttribute('aria-invalid', 'true');
  await check(page);
  await amount.fill('8');
  await page.getByRole('button', { name: 'Save amount', exact: true }).click();
  await expect(page.locator('form.tsys-editor')).toHaveAttribute('aria-busy', 'true');
  await check(page);
  await expect(
    page.getByRole('alert').filter({ hasText: 'Simulated server' }).first(),
  ).toBeVisible();
  await check(page);
  await expect(amount).toHaveValue('8');
});
test('complex validation focuses the first invalid field rather than the first field', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Edit details', exact: true }).click();
  const amount = page.getByRole('spinbutton', { name: 'Amount in kg' });
  await amount.fill('-2');
  await page.getByRole('button', { name: 'Save details', exact: true }).click();
  await expect(amount).toBeFocused();
  await expect(amount).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('output')).toContainText('Requests: 0');
  await check(page);
});
