import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';

test('Material editors mount on demand, expose associated field errors, and record overlay DOM', async ({
  page,
}) => {
  await page.goto('/grid-demo');
  await expect(page.getByRole('button', { name: 'Reset demo' })).toBeEnabled();
  const resting = await page.locator('ag-grid-angular').evaluate((root) => {
    const hosts = [...root.querySelectorAll('.grid-cell')];
    return {
      hosts: hosts.length,
      directChildren: hosts.reduce((sum, host) => sum + host.children.length, 0),
      descendants: hosts.reduce((sum, host) => sum + host.querySelectorAll('*').length, 0),
    };
  });
  const observations = [];
  await mkdir('artifacts', { recursive: true });
  for (const [kind, column] of [
    ['popover', 'name'],
    ['dialog', 'notes'],
    ['details', 'details'],
    ['dropdown', 'unit-dropdown'],
  ] as const) {
    if (kind === 'dropdown')
      await page.locator('.ag-grid-viewport').evaluate((element) => (element.scrollLeft = 650));
    const cell = page.locator(`.ag-row[row-id="row-00001"] [col-id="${column}"]`);
    await cell.hover();
    await cell.locator('button').click();
    const panel = page.getByRole('dialog');
    await expect(panel).toBeVisible();
    if (kind === 'popover') {
      const input = panel.getByLabel('Value', { exact: true });
      await input.fill('');
      await input.blur();
      await expect(panel.locator('mat-error')).toHaveText('Enter a valid value.');
      // Material omits aria-invalid for an empty required input; required and the error description remain associated.
      await expect(input).toHaveAttribute('aria-required', 'true');
      await input.fill('x'.repeat(61));
      await input.blur();
      await expect(input).toHaveAttribute('aria-invalid', 'true');
      const describedBy = await input.getAttribute('aria-describedby');
      expect(describedBy).toContain(await panel.locator('mat-error').getAttribute('id'));
    }
    expect(
      (await new AxeBuilder({ page }).include('.cdk-overlay-container').analyze()).violations,
    ).toEqual([]);
    observations.push({
      kind,
      elements: await page
        .locator('.cdk-overlay-pane')
        .evaluate((root) => root.querySelectorAll('*').length),
    });
    await panel.screenshot({ path: `artifacts/material-editor-${kind}.png` });
    await page.keyboard.press('Escape');
    await expect(page.locator('.cdk-overlay-pane')).toHaveCount(0);
  }
  await writeFile(
    'artifacts/material-editors.json',
    JSON.stringify(
      { resting, observations, remainingOverlays: await page.locator('.cdk-overlay-pane').count() },
      null,
      2,
    ),
  );
});

test('Material form fields and actions fit a narrow custom popover', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/grid-demo');
  const pen = page.locator('.ag-row[row-id="row-00001"] [col-id="name"] button');
  await pen.evaluate((element: HTMLButtonElement) => element.click());
  const panel = page.getByRole('dialog', { name: 'Edit material name' });
  await expect(panel).toBeVisible();
  const box = (await panel.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await expect(panel.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();
  await panel.screenshot({ path: 'artifacts/material-editor-narrow.png' });
  await page.keyboard.press('Escape');
  await expect(page.locator('.cdk-overlay-pane')).toHaveCount(0);
});
