import { test, expect } from '@playwright/test';
test('permissions remain independent and choice options enforce policy', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'Edit amount item-3', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('switch', { name: 'Review item-3', exact: true }).first(),
  ).toBeEnabled();
  await expect(page.getByRole('combobox', { name: 'Category item-3', exact: true })).toBeDisabled();
  const choice = page.getByRole('combobox', { name: 'Category item-0', exact: true });
  await expect(choice.getByRole('option', { name: 'Other', exact: true })).toBeDisabled();
  await choice.selectOption({ label: 'Labor' });
  await expect(choice).toBeDisabled();
  await expect(choice).toBeEnabled();
  await expect(choice).toHaveValue('1');
  await page.getByRole('button', { name: 'Mute text' }).click();
  await expect(page.locator('tsys-text-cell .tsys-muted').first()).toBeVisible();
  await expect(
    page.getByRole('switch', { name: 'Review item-3', exact: true }).first(),
  ).toBeEnabled();
});
test('keyboard enters and exits amount, switch and choice cells', async ({ page }) => {
  await page.goto('/');
  const amount = page.getByRole('button', { name: 'Edit amount item-0', exact: true });
  const cell = amount.locator('xpath=ancestor::*[@role="gridcell"]');
  await cell.focus();
  await page.keyboard.press('F2');
  await expect(amount).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(cell).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(amount).toBeFocused();
  await page.keyboard.press('Tab');
  const reviewCell = page
    .getByRole('switch', { name: 'Review item-0', exact: true })
    .first()
    .locator('xpath=ancestor::*[@role="gridcell"]');
  await expect(reviewCell).toBeFocused();
  await page.keyboard.press('F2');
  await expect(
    page.getByRole('switch', { name: 'Review item-0', exact: true }).first(),
  ).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(cell).toBeFocused();
  const choice = page.getByRole('combobox', { name: 'Category item-0', exact: true });
  await choice.locator('xpath=ancestor::*[@role="gridcell"]').focus();
  await page.keyboard.press('F2');
  await expect(choice).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(choice.locator('xpath=ancestor::*[@role="gridcell"]')).toBeFocused();
});
