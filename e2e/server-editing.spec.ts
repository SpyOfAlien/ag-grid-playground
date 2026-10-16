import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
async function openDetails(page: Page, rowId = 'row-00001') {
  const cell = page.locator(`.ag-row[row-id="${rowId}"] [col-id="details"]`);
  await cell.hover();
  await cell.locator('button').click();
  return page.getByRole('dialog', { name: 'Edit row details' });
}
async function serverMode(page: Page) {
  await page.goto('/grid-demo');
  await expect(page.getByRole('button', { name: 'Reset demo' })).toBeEnabled();
  await page.getByLabel('Persistence mode').selectOption('server');
}

test('server details and approval apply normalized authoritative updates and refresh dependent units', async ({
  page,
}) => {
  await serverMode(page);
  const name = page.locator('.ag-row[row-id="row-00001"] [col-id="name"] .grid-cell-content');
  let dialog = await openDetails(page);
  await dialog.getByLabel('Details name').fill('  Server row  ');
  await dialog.getByLabel('Details amount').fill('123.456');
  await dialog.getByLabel('Details notes').fill('  Server notes  ');
  await dialog.getByRole('button', { name: 'Save details', exact: true }).click();
  await expect(page.getByTestId('edit-pending')).toHaveText('Pending edits: 1');
  await expect(name).toHaveText('Material 00001');
  await expect(page.locator('.mode-control select')).toBeDisabled();
  await expect(dialog).toHaveCount(0);
  await expect(name).toHaveText('Server row');
  await expect(
    page.locator('.ag-row[row-id="row-00001"] [col-id="metric-2"] .grid-cell-content'),
  ).toHaveText('123.46 kg');
  dialog = await openDetails(page);
  await expect(dialog.getByLabel('Details notes')).toHaveValue('Server notes');
  await dialog.getByRole('button', { name: 'Save and approve' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.locator('.ag-row[row-id="row-00001"] [col-id="metric-0"] .grid-cell-content'),
  ).toHaveText('0.00 t');
  await expect(
    page.locator('.ag-row[row-id="row-00001"] [col-id="metric-1"] .grid-cell-content'),
  ).toHaveText('1.31 t');
  await expect(
    page.locator('.ag-row[row-id="row-00002"] [col-id="name"] .grid-cell-content'),
  ).toHaveText('Material 00002');
  await expect(page.getByTestId('demo-api-calls')).toHaveText('Demo API calls: 2');
  await expect(page.getByTestId('edit-pending')).toHaveText('Pending edits: 0');
});

test('failed server edits preserve committed data and the open draft, and can be retried', async ({
  page,
}) => {
  await serverMode(page);
  await page.getByLabel('API response').selectOption('failure');
  const dialog = await openDetails(page);
  await dialog.getByLabel('Details name').fill('Keep this draft');
  await dialog.getByRole('button', { name: 'Save details', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Demo server rejected this edit.');
  await expect(dialog.getByLabel('Details name')).toHaveValue('Keep this draft');
  await expect(
    page.locator('.ag-row[row-id="row-00001"] [col-id="name"] .grid-cell-content'),
  ).toHaveText('Material 00001');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('status')).toHaveText('Edit failed: Demo server rejected this edit.');
  await page.getByLabel('API response').selectOption('success');
  await openDetails(page);
  await dialog.getByLabel('Details name').fill('Retry succeeded');
  await dialog.getByRole('button', { name: 'Save details', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('Server edit saved: row-00001.');
});

for (const outcome of ['success', 'failure'] as const) {
  test(`closing a server editor leaves its ${outcome} response and table feedback intact`, async ({
    page,
  }) => {
    await serverMode(page);
    await page.getByLabel('API response').selectOption(outcome);
    const dialog = await openDetails(page);
    await dialog.getByLabel('Details name').fill('Saved after Escape');
    await dialog.getByRole('button', { name: 'Save details', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('status')).toHaveText(
      outcome === 'success'
        ? 'Server edit saved: row-00001.'
        : 'Edit failed: Demo server rejected this edit.',
    );
    await expect(
      page.locator('.ag-row[row-id="row-00001"] [col-id="name"] .grid-cell-content'),
    ).toHaveText(outcome === 'success' ? 'Saved after Escape' : 'Material 00001');
    await expect(page.getByTestId('edit-pending')).toHaveText('Pending edits: 0');
    await expect(page.getByTestId('demo-api-calls')).toHaveText('Demo API calls: 1');
  });
}

test('the same complex editor validates internally and approves an unreviewed client row without API calls', async ({
  page,
}) => {
  await page.goto('/grid-demo');
  const dialog = await openDetails(page, 'row-00002');
  await dialog.getByLabel('Details name').fill('');
  await expect(dialog.getByRole('button', { name: 'Save and approve' })).toBeDisabled();
  await dialog.getByLabel('Details name').fill('Client approval');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await dialog.getByRole('button', { name: 'Save and approve' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.locator('.ag-row[row-id="row-00002"] [col-id="name"] .grid-cell-content'),
  ).toHaveText('Client approval');
  await expect(
    page.locator('.ag-row[row-id="row-00002"] [col-id="review-toggle"] button'),
  ).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('demo-api-calls')).toHaveText('Demo API calls: 0');
});
