import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
const placements = [
  'top',
  'topLeft',
  'topRight',
  'bottom',
  'bottomLeft',
  'bottomRight',
  'left',
  'leftTop',
  'leftBottom',
  'right',
  'rightTop',
  'rightBottom',
];
for (const backdrop of [false, true]) {
  test(`background scrolling defaults to blocked and can be enabled with backdrop ${backdrop}`, async ({
    page,
  }) => {
    await page.goto('/popover-demo');
    await page.evaluate(() => {
      const spacer = document.createElement('div');
      spacer.style.height = '3000px';
      document.body.append(spacer);
    });
    await page.getByLabel('Backdrop', { exact: true }).setChecked(backdrop);
    const trigger = page.getByRole('button', { name: 'bottom', exact: true });
    await trigger.click();
    await page.mouse.move(10, 300);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await page.keyboard.press('Escape');
    await page.getByLabel('Allow background scrolling').check();
    await trigger.click();
    await page.mouse.move(10, 300);
    await page.mouse.wheel(0, 400);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.cdk-overlay-pane')).toHaveCount(0);
    expect(
      await page.evaluate(() =>
        document.documentElement.classList.contains('cdk-global-scrollblock'),
      ),
    ).toBe(false);
  });
}
test('positions all twelve placements and restores focus on Escape with no orphan panes', async ({
  page,
}) => {
  await page.goto('/popover-demo');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const placement of placements) {
    const trigger = page.getByRole('button', { name: placement, exact: true });
    await trigger.click();
    const panel = page.getByRole('dialog', { name: 'Popover example' });
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-placement', placement);
    await expect(page.getByLabel('Example value')).toBeFocused();
    await expect(panel.locator('.popover-arrow')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(
      page.locator('.cdk-overlay-pane, .cdk-overlay-connected-position-bounding-box'),
    ).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test('flips at viewport edges, updates the arrow after content resize, and constrains large dimensions', async ({
  page,
}) => {
  await page.goto('/popover-demo');
  await page.getByRole('button', { name: 'Top left edge' }).click();
  const panel = page.getByRole('dialog', { name: 'Popover example' });
  await expect(panel).toHaveAttribute('data-side', 'bottom');
  await expect(panel).toBeVisible();
  const first = await panel.boundingBox();
  expect(first!.x).toBeGreaterThanOrEqual(11);
  expect(first!.y).toBeGreaterThanOrEqual(11);
  const arrow = await panel.locator('.popover-arrow').boundingBox();
  expect(arrow!.y).toBeLessThan(first!.y);
  await page.getByRole('button', { name: 'Resize content' }).click();
  await expect.poll(async () => (await panel.boundingBox())!.height).toBeGreaterThan(first!.height);
  await page.keyboard.press('Escape');
  await page.getByLabel('Width', { exact: true }).fill('2000');
  await page.getByLabel('Width', { exact: true }).press('Tab');
  await page.getByLabel('Height', { exact: true }).fill('2000');
  await page.getByLabel('Height', { exact: true }).press('Tab');
  await page.getByRole('button', { name: 'Bottom right edge' }).click();
  await expect(panel).toBeVisible();
  const bounds = await panel.boundingBox();
  const viewport = page.viewportSize()!;
  expect(bounds!.width).toBeLessThanOrEqual(viewport.width - 23);
  expect(bounds!.height).toBeLessThanOrEqual(viewport.height - 23);
  expect(bounds!.x).toBeGreaterThanOrEqual(11);
  expect(bounds!.y).toBeGreaterThanOrEqual(11);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width - 11);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height - 11);
  await page.keyboard.press('Escape');
});

test('repositions after viewport resize and permits scrolling inside a fixed-height panel', async ({
  page,
}) => {
  await page.goto('/popover-demo');
  await page.getByLabel('Height', { exact: true }).fill('150');
  await page.getByLabel('Height', { exact: true }).press('Tab');
  await page.getByRole('button', { name: 'Bottom right edge' }).click();
  const panel = page.getByRole('dialog');
  const body = panel.locator('.popover-body');
  await expect(panel).toBeVisible();
  await expect
    .poll(() => body.evaluate((element) => element.scrollHeight > element.clientHeight))
    .toBe(true);
  await body.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await page.setViewportSize({ width: 600, height: 720 });
  await expect
    .poll(async () => {
      const bounds = (await panel.boundingBox())!;
      return (
        bounds.x >= 11 &&
        bounds.y >= 11 &&
        bounds.x + bounds.width <= 589 &&
        bounds.y + bounds.height <= 709
      );
    })
    .toBe(true);
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
});

test('supports no backdrop, dismissible backdrop, and persistent backdrop while Escape always closes', async ({
  page,
}) => {
  await page.goto('/popover-demo');
  const trigger = page.getByRole('button', { name: 'bottom', exact: true });
  await trigger.click();
  await expect(page.locator('.kit-popover-backdrop')).toHaveCount(0);
  await page.getByRole('heading', { name: 'Standalone popover' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByLabel('Backdrop', { exact: true }).check();
  await trigger.click();
  await page.locator('.kit-popover-backdrop').click({ position: { x: 5, y: 5 } });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Close on backdrop click').uncheck();
  await trigger.click();
  await page.locator('.kit-popover-backdrop').click({ position: { x: 5, y: 5 } });
  await expect(page.getByRole('dialog')).toBeVisible();
  // Even an inner control swallowing bubble-phase Escape cannot block closing.
  await page
    .getByLabel('Example value')
    .evaluate((input) => input.addEventListener('keydown', (event) => event.stopPropagation()));
  await page.getByLabel('Example value').focus();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.kit-popover-backdrop')).toHaveCount(0);
});

test('uses click-point fallback, programmatic trigger fallback, and optional arrow', async ({
  page,
}) => {
  await page.goto('/popover-demo');
  const pointTrigger = page.getByRole('button', { name: 'Click point anchor' });
  const box = await pointTrigger.boundingBox();
  await pointTrigger.click({ position: { x: 12, y: 12 } });
  const panel = page.getByRole('dialog');
  await expect(panel).toBeVisible();
  const arrow = await panel.locator('.popover-arrow').boundingBox();
  expect(Math.abs(arrow!.x + arrow!.width / 2 - (box!.x + 12))).toBeLessThan(2);
  await page.keyboard.press('Escape');
  await page.getByLabel('Arrow', { exact: true }).uncheck();
  const trigger = page.getByRole('button', { name: 'Programmatic trigger anchor' });
  await trigger.click();
  await expect(panel).toBeVisible();
  await expect(panel.locator('.popover-arrow')).toHaveCount(0);
  const anchor = await trigger.boundingBox();
  const bounds = await panel.boundingBox();
  expect(Math.abs(bounds!.x + bounds!.width / 2 - (anchor!.x + anchor!.width / 2))).toBeLessThan(2);
  await page.getByRole('button', { name: 'Close popover' }).click();
  await expect(panel).toHaveCount(0);
});

test('traps keyboard focus, disposes on owner navigation, and has no axe violations', async ({
  page,
}) => {
  await page.goto('/popover-demo');
  await page.getByLabel('Backdrop', { exact: true }).check();
  await page.getByRole('button', { name: 'bottom', exact: true }).click();
  const panel = page.getByRole('dialog');
  await expect(panel).toBeVisible();
  await page.getByRole('button', { name: 'Close popover' }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Example value')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Close popover' })).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  mkdirSync('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/popover-step-6.png' });
  await page.keyboard.press('Escape');
  await page.getByLabel('Backdrop', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'bottom', exact: true }).click();
  await page.getByRole('link', { name: 'Back to the grid' }).click();
  await expect(page).toHaveURL(/grid-demo$/);
  await expect(
    page.locator('.kit-popover-pane, .kit-popover-backdrop, app-popover-panel'),
  ).toHaveCount(0);
});
