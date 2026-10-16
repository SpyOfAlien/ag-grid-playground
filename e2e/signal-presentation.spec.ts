import { expect, test } from '@playwright/test';

// Observe the public grid API in the development build without adding production hooks.
async function observeGrid(page: import('@playwright/test').Page): Promise<void> {
  await page.locator('ag-grid-angular').evaluate((root) => {
    type Api = {
      refreshCells: (params?: unknown) => unknown;
      setGridOption: (key: string, value: unknown) => unknown;
    };
    const angular = (
      window as unknown as { ng: { getComponent: (element: Element) => { api: Api } } }
    ).ng;
    const api = angular.getComponent(root).api;
    const refresh = api.refreshCells.bind(api);
    const setOption = api.setGridOption.bind(api);
    root.setAttribute('data-refresh-count', '0');
    root.setAttribute('data-column-count', '0');
    api.refreshCells = (params) => {
      root.setAttribute(
        'data-refresh-count',
        String(Number(root.getAttribute('data-refresh-count')) + 1),
      );
      return refresh(params);
    };
    api.setGridOption = (key, value) => {
      if (key === 'columnDefs')
        root.setAttribute(
          'data-column-count',
          String(Number(root.getAttribute('data-column-count')) + 1),
        );
      return setOption(key, value);
    };
  });
}

test('presentation signals update existing numeric content without grid refresh or new definitions', async ({
  page,
}) => {
  await page.goto('/grid-demo');
  const content = page.locator(
    '.ag-row[row-id="row-00001"] [col-id="metric-2"] .grid-cell-content',
  );
  await expect(content).toHaveText('2.62 kg');
  await content.evaluate((element) => element.setAttribute('data-original', 'true'));
  const header = page.locator('.ag-header-cell[col-id="metric-2"]');
  await header.evaluate((element) => element.setAttribute('data-original', 'true'));
  await observeGrid(page);
  await page.getByRole('checkbox', { name: 'Show units' }).uncheck();
  await expect(content).toHaveText('2.62');
  await expect(content).toHaveAttribute('data-original', 'true');
  await expect(header).toHaveAttribute('data-original', 'true');
  await expect(page.locator('ag-grid-angular')).toHaveAttribute('data-refresh-count', '0');
  await expect(page.locator('ag-grid-angular')).toHaveAttribute('data-column-count', '0');
  await page.getByRole('checkbox', { name: 'Show units' }).check();
  await expect(content).toHaveText('2.62 kg');
  await expect(page.locator('ag-grid-angular')).toHaveAttribute('data-refresh-count', '0');
});

test('new virtualized composite renderers read the current presentation settings', async ({
  page,
}) => {
  await page.setViewportSize({ width: 700, height: 1000 });
  await page.goto('/grid-demo');
  const composite = page.locator('.ag-row[row-id="row-00001"] [col-id="toggle-number"]');
  await expect(page.locator('.ag-row[row-id="row-00001"] [col-id="name"]')).toBeVisible();
  await expect(composite).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Show units' }).uncheck();
  await page
    .locator('.ag-grid-viewport')
    .evaluate((element) => (element.scrollLeft = element.scrollWidth));
  await expect(composite.locator('span.grid-cell-content')).toHaveText('9.17');
  await page.getByRole('checkbox', { name: 'Show units' }).check();
  await expect(composite.locator('span.grid-cell-content')).toHaveText('9.17 kg');
});

test('persistence mode is selected through the save callback and row commits still refresh', async ({
  page,
}) => {
  await page.goto('/grid-demo');
  const cell = page.locator('.ag-row[row-id="row-00001"] [col-id="metric-2"]');
  await expect(cell.locator('.grid-cell-content')).toHaveText('2.62 kg');
  await observeGrid(page);
  await page.getByRole('checkbox', { name: 'Show units' }).uncheck();
  await page.getByLabel('Persistence mode').selectOption('server');
  await expect(page.locator('ag-grid-angular')).toHaveAttribute('data-refresh-count', '0');
  await cell.hover();
  await cell.locator('button').click();
  const editor = page.getByRole('dialog', { name: 'Edit measurement' });
  await editor.getByLabel('Value', { exact: true }).fill('18.567');
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(cell.locator('.grid-cell-content')).toHaveText('18.57');
  await expect(page.getByTestId('demo-api-calls')).toHaveText('Demo API calls: 1');
  await expect
    .poll(() => page.locator('ag-grid-angular').getAttribute('data-refresh-count'))
    .not.toBe('0');
  await expect(page.locator('ag-grid-angular')).toHaveAttribute('data-column-count', '0');
});
