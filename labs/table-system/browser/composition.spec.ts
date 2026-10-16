import { test, expect } from '@playwright/test';
test('same numeric editor runs in dialog, details Save and Approve update dependent rows', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Amount dialog', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Amount in kg' }).fill('19');
  await page.getByRole('button', { name: 'Save amount' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit details', exact: true }).click();
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Revised');
  await page.getByRole('spinbutton', { name: 'Amount in kg' }).fill('23');
  await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('multi-field draft');
  await page.getByRole('button', { name: 'Save and approve', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('switch', { name: 'Review item-0', exact: true }).first(),
  ).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('button', { name: 'Edit amount item-0', exact: true })).toContainText(
    '23.00 kg',
  );
  await expect(
    page.locator('tsys-text-cell').filter({ hasText: 'Item 1' }).first().locator('span').first(),
  ).toHaveAttribute('aria-label', /Dependent update from Revised/);
  await expect(
    page.getByRole('button', { name: 'Composite amount item-0', exact: true }),
  ).toContainText('23.00 kg');
});
test('composite layout traverses both controls in both directions', async ({ page }) => {
  await page.goto('/');
  const review = page.getByRole('switch', { name: 'Composite review item-0', exact: true });
  const amount = page.getByRole('button', { name: 'Composite amount item-0', exact: true });
  const cell = review.locator('xpath=ancestor::*[@role="gridcell"]');
  await cell.focus();
  await page.keyboard.press('F2');
  await expect(review).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(amount).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(review).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(cell).toBeFocused();
});
test('text and multiline editors share lifecycle', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Edit name', exact: true }).click();
  await page.getByRole('textbox', { name: 'Edit name', exact: true }).fill('Named');
  await page.getByRole('button', { name: 'Save text' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit notes', exact: true }).click();
  await page.getByRole('textbox', { name: 'Edit notes', exact: true }).fill('Line one\nLine two');
  await page.getByRole('button', { name: 'Save text' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('choice editor content submits through the same operation binding', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Edit category', exact: true }).click();
  const choice = page.getByRole('combobox', { name: 'Edit category', exact: true });
  await expect(choice.locator('option[value="other"]')).toHaveJSProperty('disabled', true);
  await choice.selectOption({ label: 'Labor' });
  await page.getByRole('button', { name: 'Save text', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Category item-0', exact: true })).toHaveValue(
    '1',
  );
});
