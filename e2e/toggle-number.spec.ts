import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
async function composite(page: Page) {
  await page.goto('/grid-demo');
  await expect(page.getByRole('button', { name: 'Reset demo' })).toBeEnabled();
  await page.locator('.ag-grid-viewport').evaluate((element) => (element.scrollLeft = 1100));
  const cell = page.locator('.ag-row[row-id="row-00001"] [col-id="toggle-number"]');
  await expect(cell).toBeVisible();
  return {
    cell,
    toggle: cell.getByRole('switch'),
    pen: cell.getByRole('button', { name: 'Edit Review + amount' }),
    number: cell.locator('span.grid-cell-content'),
  };
}
test('composite preserves amount/DOM while toggling permissions and saves its number through the same client service', async ({
  page,
}) => {
  const { cell, toggle, pen, number } = await composite(page);
  await expect(number).toHaveText('9.17 kg');
  await number.evaluate((element) => element.setAttribute('data-original', 'true'));
  await toggle.evaluate((element) => element.setAttribute('data-original', 'true'));
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(number).toHaveText('9.17 kg');
  await expect(pen).toHaveAttribute('aria-disabled', 'true');
  await expect(pen).toHaveAttribute('title', 'Review this row before editing');
  await expect(number).toHaveAttribute('data-original', 'true');
  await expect(toggle).toHaveAttribute('data-original', 'true');
  await expect(cell.locator('.grid-cell-marker')).toHaveAttribute('data-kind', 'warning');
  await cell.hover();
  await pen.dispatchEvent('click');
  await expect(page.locator('app-input-editor')).toHaveCount(0);
  await toggle.focus();
  await page.keyboard.press('Space');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await cell.hover();
  await pen.click();
  const popup = page.locator('.kit-popover-panel');
  await expect(popup.getByLabel('Value', { exact: true })).toHaveValue('9.17');
  await popup.getByLabel('Value', { exact: true }).fill('1234.5');
  await popup.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(popup).toHaveCount(0);
  await expect(number).toHaveText('1,234.50 kg');
  await expect(page.getByTestId('demo-api-calls')).toHaveText('Demo API calls: 0');
  await expect(cell.locator('app-toggle-cell,app-number-cell')).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test('composite server toggle failure preserves editability and number saves apply normalized results', async ({
  page,
}) => {
  const { cell, toggle, pen, number } = await composite(page);
  await page.getByLabel('Persistence mode').selectOption('server');
  await page.getByLabel('API response').selectOption('failure');
  await toggle.click();
  await expect(page.getByTestId('edit-pending')).toHaveText('Pending edits: 1');
  await cell.hover();
  await pen.dispatchEvent('click');
  await expect(page.locator('app-input-editor')).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('Edit failed: Demo server rejected this edit.');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(number).toHaveText('9.17 kg');
  await page.getByLabel('API response').selectOption('success');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(pen).toHaveAttribute('aria-disabled', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await cell.hover();
  await pen.click();
  const popup = page.locator('.kit-popover-panel');
  await popup.getByLabel('Value', { exact: true }).fill('18.567');
  await popup.getByRole('button', { name: 'Save', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(popup).toHaveCount(0);
  await expect(number).toHaveText('18.57 kg');
  await expect(page.getByTestId('demo-api-calls')).toHaveText('Demo API calls: 4');
});
test('composite formatter includes the unit for zero and excludes it for a missing value', async ({
  page,
}) => {
  const { cell, pen, number } = await composite(page);
  await cell.hover();
  await pen.click();
  const popup = page.locator('.kit-popover-panel');
  await popup.getByLabel('Value', { exact: true }).fill('0');
  await popup.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(number).toHaveText('0.00 kg');
  // Deterministic fixture row 12 has a null measurement at metric index 7.
  const empty = page.locator(
    '.ag-row[row-id="row-00012"] [col-id="toggle-number"] span.grid-cell-content',
  );
  await expect(empty).toHaveText('');
});
