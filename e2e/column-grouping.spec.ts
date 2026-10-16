import { expect, test, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function shiftDrag(page: Page, source: Locator, target: Locator): Promise<void> {
  await page.keyboard.down('Shift');
  try {
    await source.dragTo(target);
  } finally {
    await page.keyboard.up('Shift');
  }
}

async function middleDrag(page: Page, source: Locator, target: Locator): Promise<void> {
  await source.hover();
  const start = await source.boundingBox();
  const destination = await target.boundingBox();
  if (!start || !destination) throw new Error('Headers are missing');
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(start.x + start.width / 2 + 8, start.y + start.height / 2);
  await expect(page.locator('.ag-dnd-ghost')).toBeVisible();
  await page.mouse.move(
    destination.x + destination.width / 2,
    destination.y + destination.height / 2,
  );
  await expect(target).toHaveClass(/column-group-destination/);
  await page.mouse.up({ button: 'middle' });
  await expect(page.locator('.ag-dnd-ghost')).toHaveCount(0);
}

test('middle mouse grouping is opt-in and Shift grouping still works', async ({ page }) => {
  await page.goto('/column-group-demo');
  await expect(page.getByRole('checkbox', { name: 'Middle mouse grouping' })).not.toBeChecked();
  const source = page.locator('.ag-header-cell[col-id="id"]');
  const target = page.locator('.ag-header-cell[col-id="name"]');
  const start = await source.boundingBox();
  const destination = await target.boundingBox();
  if (!start || !destination) throw new Error('Headers are missing');
  await page.mouse.move(start.x + 50, start.y + 22);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(destination.x + 50, destination.y + 22);
  await expect(page.locator('.column-group-destination, .ag-dnd-ghost')).toHaveCount(0);
  await page.mouse.up({ button: 'middle' });
  await expect(page.locator('.ag-header-group-cell')).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Middle mouse grouping' }).check();
  await page.getByRole('checkbox', { name: 'Middle mouse grouping' }).uncheck();
  await shiftDrag(page, source, target);
  await expect(page.locator('.ag-header-group-cell')).toHaveCount(1);
});

test('middle-drag groups, joins groups and nests children without Shift', async ({ page }) => {
  await page.goto('/column-group-demo');
  const option = page.getByRole('checkbox', { name: 'Middle mouse grouping' });
  await option.focus();
  await page.keyboard.press('Space');
  await expect(option).toBeChecked();
  const header = (id: string) => page.locator(`.ag-header-cell[col-id="${id}"]`);
  await header('id').click();
  const width = await header('id').evaluate((el) => el.getBoundingClientRect().width);
  await middleDrag(page, header('id'), header('name'));
  await expect(groupHeader(page, 'group:name:id')).toContainText('Name + Row ID');
  await expect(header('id')).toHaveAttribute('aria-sort', 'ascending');
  expect(await header('id').evaluate((el) => el.getBoundingClientRect().width)).toBe(width);
  await middleDrag(page, header('revenue'), groupHeader(page, 'group:name:id'));
  await expect(realGroups(page)).toHaveCount(1);
  await expect(groupHeader(page, 'group:name:id')).toContainText('Name + Row ID + Revenue');
  await middleDrag(page, header('cost'), header('name'));
  await expect(realGroups(page)).toHaveCount(2);
  await expect(groupHeader(page, 'group:name:cost')).toContainText('Name + Cost');
  // Shift changes during a middle-drag do not turn off grouping.
  await header('cost').hover();
  const start = await header('cost').boundingBox();
  const destination = await groupHeader(page, 'group:name:id').boundingBox();
  if (!start || !destination) throw new Error('Headers are missing');
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down({ button: 'middle' });
  await page.keyboard.down('Shift');
  await page.mouse.move(
    destination.x + destination.width / 2,
    destination.y + destination.height / 2,
  );
  await page.keyboard.up('Shift');
  await expect(groupHeader(page, 'group:name:id')).toHaveClass(/column-group-destination/);
  await page.mouse.up({ button: 'middle' });
  await expect(realGroups(page)).toHaveCount(1);
  await expect(groupHeader(page, 'group:name:id')).toContainText('Name + Row ID + Revenue + Cost');
  await expect(page.locator('.ag-row[row-id]')).toHaveCount(12);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('middle-drag below headers ungroups only that child and preserves its state', async ({
  page,
}) => {
  await initialGroup(page);
  await page.getByRole('checkbox', { name: 'Middle mouse grouping' }).check();
  await middleDrag(
    page,
    page.locator('.ag-header-cell[col-id="revenue"]'),
    groupHeader(page, 'group:name:id'),
  );
  const source = page.locator('.ag-header-cell[col-id="id"]');
  await source.click();
  const width = await source.evaluate((el) => el.getBoundingClientRect().width);
  const start = await source.boundingBox();
  const destination = await page.locator('.ag-header-cell[col-id="cost"]').boundingBox();
  if (!start || !destination) throw new Error('Headers are missing');
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(start.x + start.width / 2 + 8, start.y + start.height / 2);
  await page.mouse.move(
    destination.x + destination.width - 5,
    destination.y + destination.height + 25,
  );
  await expect(page.locator('.column-group-destination')).toHaveCount(0);
  await page.mouse.up({ button: 'middle' });
  await expect(realGroups(page)).toHaveCount(1);
  await expect(groupHeader(page, 'group:name:id')).toContainText('Name + Revenue');
  await expect(source).toHaveAttribute('aria-sort', 'ascending');
  expect(await source.evaluate((el) => el.getBoundingClientRect().width)).toBe(width);
  await expect
    .poll(async () => Number(await source.getAttribute('aria-colindex')))
    .toBeGreaterThan(3);
  await expect(page.locator('.ag-dnd-ghost')).toHaveCount(0);
});

test('middle clicks do not group, and Escape or blur cancels middle-drag', async ({ page }) => {
  await page.goto('/column-group-demo');
  await page.getByRole('checkbox', { name: 'Middle mouse grouping' }).check();
  const source = page.locator('.ag-header-cell[col-id="id"]');
  const target = page.locator('.ag-header-cell[col-id="name"]');
  await source.evaluate((element) => {
    for (const type of ['pointerdown', 'auxclick'])
      element.ownerDocument.addEventListener(type, (event) => {
        if (event instanceof MouseEvent && event.button === 1)
          element.setAttribute(`data-middle-${type}-prevented`, String(event.defaultPrevented));
      });
  });
  await source.click({ button: 'middle' });
  await expect(source).toHaveAttribute('data-middle-pointerdown-prevented', 'true');
  await expect(source).toHaveAttribute('data-middle-auxclick-prevented', 'true');
  await expect(realGroups(page)).toHaveCount(0);
  await expect(page.locator('.ag-dnd-ghost')).toHaveCount(0);
  for (const cancel of ['escape', 'blur']) {
    const start = await source.boundingBox();
    const destination = await target.boundingBox();
    if (!start || !destination) throw new Error('Headers are missing');
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(
      destination.x + destination.width / 2,
      destination.y + destination.height / 2,
    );
    await expect(target).toHaveClass(/column-group-destination/);
    if (cancel === 'escape') await page.keyboard.press('Escape');
    else await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(page.locator('.column-group-destination, .ag-dnd-ghost')).toHaveCount(0);
    await page.mouse.up({ button: 'middle' });
    await expect(realGroups(page)).toHaveCount(0);
  }
  // Cancellation leaves native left dragging and Shift grouping usable.
  await shiftDrag(page, source, target);
  await expect(realGroups(page)).toHaveCount(1);
});

test('dropping a middle-drag outside the grid keeps group membership intact', async ({ page }) => {
  await initialGroup(page);
  await page.getByRole('checkbox', { name: 'Middle mouse grouping' }).check();
  const source = page.locator('.ag-header-cell[col-id="id"]');
  const start = await source.boundingBox();
  if (!start) throw new Error('Header is missing');
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(start.x + start.width / 2 + 8, start.y + start.height / 2);
  await expect(page.locator('.ag-dnd-ghost')).toBeVisible();
  await page.mouse.move(10, 10);
  await page.mouse.up({ button: 'middle' });
  await expect(realGroups(page)).toHaveCount(1);
  await expect(groupHeader(page, 'group:name:id')).toContainText('Name + Row ID');
  await expect(page.locator('.ag-dnd-ghost, .column-group-destination')).toHaveCount(0);
  await expect(source).toBeVisible();
});

test('dragging headers groups columns and preserves sorting and widths', async ({ page }) => {
  await page.goto('/column-group-demo');
  const source = page.locator('.ag-header-cell[col-id="id"]');
  const target = page.locator('.ag-header-cell[col-id="name"]');
  await source.click();
  await expect(source).toHaveAttribute('aria-sort', 'ascending');
  const width = await source.evaluate((element) => element.getBoundingClientRect().width);
  await shiftDrag(page, source, target);
  await expect(page.locator('.ag-header-group-cell')).toHaveCount(1);
  await expect(page.locator('app-ungroup-header span')).toHaveText('Name + Row ID');
  await expect(source).toHaveAttribute('aria-sort', 'ascending');
  expect(await source.evaluate((element) => element.getBoundingClientRect().width)).toBe(width);
  await shiftDrag(
    page,
    page.locator('.ag-header-cell[col-id="revenue"]'),
    page.locator('app-ungroup-header span'),
  );
  await expect(page.locator('app-ungroup-header span')).toHaveText('Name + Row ID + Revenue');
  await expect(page.locator('.ag-row[row-id]')).toHaveCount(12);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.locator('app-ungroup-header button').click();
  await expect(page.locator('.ag-header-group-cell')).toHaveCount(0);
  await expect(source).toHaveAttribute('aria-sort', 'ascending');
});

test('grouping controls support keyboard use and reject grouping a column with itself', async ({
  page,
}) => {
  await page.goto('/column-group-demo');
  await page.getByLabel('Column to group', { exact: true }).selectOption('id');
  await page.getByLabel('Group with', { exact: true }).selectOption('id');
  const group = page.getByRole('button', { name: 'Group columns', exact: true });
  await group.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.ag-header-group-cell')).toHaveCount(0);
  await page.getByLabel('Group with', { exact: true }).selectOption('name');
  await group.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.ag-header-group-cell')).toHaveCount(1);
  await expect(group).toBeFocused();
});

test('normal dragging moves columns and groups, and inline ungroup preserves their position', async ({
  page,
}) => {
  await page.goto('/column-group-demo');
  const header = (id: string) => page.locator(`.ag-header-cell[col-id="${id}"]`);
  const ids = () =>
    page.locator('.ag-header-cell[col-id]').evaluateAll((elements) =>
      elements
        .map((element) => ({
          id: element.getAttribute('col-id'),
          x: Number(element.getAttribute('aria-colindex')),
        }))
        .sort((a, b) => a.x - b.x)
        .map((element) => element.id),
    );
  await header('id').dragTo(header('revenue'), { targetPosition: { x: 155, y: 22 } });
  await expect(page.locator('.ag-header-group-cell')).toHaveCount(0);
  await expect.poll(async () => (await ids()).indexOf('id')).toBeGreaterThan(0);
  await shiftDrag(page, header('id'), header('name'));
  await expect(page.locator('.ag-header-group-cell')).toHaveCount(1);
  const before = await ids();
  const groupLabel = page.locator('app-ungroup-header span');
  await groupLabel.dragTo(header('cost'));
  await expect.poll(ids).not.toEqual(before);
  const moved = await ids();
  await page.locator('app-ungroup-header button').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.ag-header-group-cell')).toHaveCount(0);
  expect(await ids()).toEqual(moved);
  await expect(header('name')).toBeFocused();
});

test('the full header highlights with a faded border only while the cursor is inside', async ({
  page,
}) => {
  await page.goto('/column-group-demo');
  const source = page.locator('.ag-header-cell[col-id="id"]');
  const target = page.locator('.ag-header-cell[col-id="name"]');
  const start = await source.boundingBox();
  const destination = await target.boundingBox();
  if (!start || !destination) throw new Error('Headers are missing');
  await page.keyboard.down('Shift');
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    destination.x + destination.width - 3,
    destination.y + destination.height / 2,
  );
  await expect(target).toHaveClass(/column-group-destination/);
  await expect(target).toHaveCSS('animation-name', 'none');
  await expect(target).toHaveCSS('scale', 'none');
  await expect(target).toHaveCSS('box-shadow', 'rgba(23, 103, 91, 0.7) 0px 0px 0px 2px inset');
  await expect(page.locator('.ag-header-cell[col-id="revenue"]')).not.toHaveClass(
    /column-group-destination/,
  );
  await expect(page.locator('.ag-dnd-ghost')).toBeVisible();
  await page.mouse.move(
    destination.x + destination.width - 3,
    destination.y + destination.height + 40,
  );
  await expect(page.locator('.column-group-destination')).toHaveCount(0);
  await expect(page.locator('ag-grid-angular')).not.toHaveClass(/column-group-hover/);
  await page.keyboard.up('Shift');
  await page.mouse.up();
  await expect(page.locator('.ag-header-group-cell')).toHaveCount(0);
});

test('dropping on a highlighted column groups it and escape clears the destination', async ({
  page,
}) => {
  await page.goto('/column-group-demo');
  const source = page.locator('.ag-header-cell[col-id="id"]');
  const target = page.locator('.ag-header-cell[col-id="name"]');
  const start = await source.boundingBox();
  const destination = await target.boundingBox();
  if (!start || !destination) throw new Error('Headers are missing');
  const moveIntoCenter = async () => {
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.keyboard.down('Shift');
    await page.mouse.down();
    await page.mouse.move(start.x + start.width / 2 + 8, start.y + start.height / 2);
    await page.mouse.move(
      destination.x + destination.width / 2,
      destination.y + destination.height / 2,
    );
  };
  await moveIntoCenter();
  await expect(target).toHaveClass(/column-group-destination/);
  await page.keyboard.press('Escape');
  await expect(target).not.toHaveClass(/column-group-destination/);
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await expect(page.locator('.ag-header-group-cell')).toHaveCount(0);
  await moveIntoCenter();
  await expect(target).toHaveClass(/column-group-destination/);
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await expect(page.getByTestId('column-group-preview')).toHaveCount(0);
  await expect(page.locator('app-ungroup-header span')).toHaveText('Name + Row ID');
});

test('an existing group header accepts another column with a faded static border', async ({
  page,
}) => {
  await page.goto('/column-group-demo');
  await shiftDrag(
    page,
    page.locator('.ag-header-cell[col-id="id"]'),
    page.locator('.ag-header-cell[col-id="name"]'),
  );
  const group = page
    .locator('.ag-header-group-cell')
    .filter({ has: page.locator('app-ungroup-header') });
  const source = page.locator('.ag-header-cell[col-id="revenue"]');
  const start = await source.boundingBox();
  const destination = await group.boundingBox();
  if (!start || !destination) throw new Error('Headers are missing');
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.keyboard.down('Shift');
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + 8, start.y + start.height / 2);
  await page.mouse.move(
    destination.x + destination.width / 2,
    destination.y + destination.height / 2,
  );
  await expect(group).toHaveClass(/column-group-destination/);
  await expect(group).toHaveCSS('animation-name', 'none');
  await expect(group).toHaveCSS('box-shadow', 'rgba(23, 103, 91, 0.7) 0px 0px 0px 2px inset');
  await expect(page.getByTestId('column-group-preview')).toHaveCount(0);
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await expect(page.locator('app-ungroup-header span')).toHaveText('Name + Row ID + Revenue');
  await expect(page.locator('.column-group-destination')).toHaveCount(0);
  await expect(page.locator('.ag-header-group-cell')).toHaveCount(1);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('the floating header keeps moving over a grouping destination', async ({ page }) => {
  await page.goto('/column-group-demo');
  const source = page.locator('.ag-header-cell[col-id="id"]');
  const target = page.locator('.ag-header-cell[col-id="name"]');
  const start = await source.boundingBox();
  const destination = await target.boundingBox();
  if (!start || !destination) throw new Error('Headers are missing');
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.keyboard.down('Shift');
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + 8, start.y + start.height / 2);
  const ghost = page.locator('.ag-dnd-ghost');
  await expect(ghost).toBeVisible();
  const x = destination.x + destination.width / 2;
  const y = destination.y + destination.height / 2;
  await page.mouse.move(x, y);
  await expect(target).toHaveClass(/column-group-destination/);
  await expect(page.locator('ag-grid-angular')).toHaveClass(/column-group-hover/);
  const before = await ghost.boundingBox();
  await page.mouse.move(x + 16, y);
  const after = await ghost.boundingBox();
  if (!before || !after) throw new Error('Floating header is missing');
  expect(after.x - before.x).toBeCloseTo(16);
  await expect(source).toHaveAttribute('aria-colindex', '1');
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await expect(page.locator('app-ungroup-header span')).toHaveText('Name + Row ID');
  await expect(page.locator('.ag-dnd-ghost')).toHaveCount(0);
  await expect(page.locator('ag-grid-angular')).not.toHaveClass(/column-group-hover/);
});

for (const kind of ['column', 'group'] as const) {
  test(`${kind} reordering has no delay outside a grouping destination even with Shift`, async ({
    page,
  }) => {
    await page.goto('/column-group-demo');
    if (kind === 'group')
      await shiftDrag(
        page,
        page.locator('.ag-header-cell[col-id="id"]'),
        page.locator('.ag-header-cell[col-id="name"]'),
      );
    const source =
      kind === 'column'
        ? page.locator('.ag-header-cell[col-id="id"]')
        : page.locator('app-ungroup-header span');
    const tracked = page.locator('.ag-header-cell[col-id="id"]');
    const target = page.locator('.ag-header-cell[col-id="cost"]');
    const start = await source.boundingBox();
    const destination = await target.boundingBox();
    if (!start || !destination) throw new Error('Headers are missing');
    const initialIndex = await tracked.getAttribute('aria-colindex');
    await page.keyboard.down('Shift');
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(start.x + start.width / 2 + 8, start.y + start.height / 2);
    const y =
      kind === 'column'
        ? destination.y + destination.height + 30
        : destination.y + destination.height / 2;
    await page.mouse.move(destination.x + destination.width - 5, y);
    await expect(tracked).not.toHaveAttribute('aria-colindex', initialIndex!);
    await expect(page.locator('.column-group-destination')).toHaveCount(0);
    await expect(page.locator('.ag-dnd-ghost')).toBeVisible();
    await page.mouse.up();
    await page.keyboard.up('Shift');
    await expect(page.locator('.ag-dnd-ghost')).toHaveCount(0);
  });
}

test('normal dragging reorders immediately without Shift or grouping highlights', async ({
  page,
}) => {
  await page.goto('/column-group-demo');
  const source = page.locator('.ag-header-cell[col-id="id"]');
  const target = page.locator('.ag-header-cell[col-id="name"]');
  const start = await source.boundingBox();
  const destination = await target.boundingBox();
  if (!start || !destination) throw new Error('Headers are missing');
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + 8, start.y + start.height / 2);
  await page.mouse.move(
    destination.x + destination.width - 4,
    destination.y + destination.height / 2,
  );
  await expect(source).toHaveAttribute('aria-colindex', '2');
  await expect(page.locator('.column-group-destination')).toHaveCount(0);
  await expect(page.locator('ag-grid-angular')).not.toHaveClass(/column-group-hover/);
  await page.mouse.up();
  await expect(page.locator('.ag-header-group-cell')).toHaveCount(0);
});

test('Shift can be pressed, released and pressed again during the same drag', async ({ page }) => {
  await page.goto('/column-group-demo');
  const source = page.locator('.ag-header-cell[col-id="id"]');
  const first = page.locator('.ag-header-cell[col-id="name"]');
  const second = page.locator('.ag-header-cell[col-id="revenue"]');
  const start = await source.boundingBox();
  const destination = await first.boundingBox();
  if (!start || !destination) throw new Error('Headers are missing');
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + 8, start.y + start.height / 2);
  await expect(page.locator('.ag-dnd-ghost')).toBeVisible();
  await expect(page.locator('ag-grid-angular')).not.toHaveClass(/column-group-hover/);
  await page.keyboard.down('Shift');
  await page.mouse.move(
    destination.x + destination.width / 2,
    destination.y + destination.height / 2,
  );
  await expect(first).toHaveClass(/column-group-destination/);
  // Releasing the key reacts at the existing pointer position, with no extra mouse movement.
  await page.keyboard.up('Shift');
  await expect(first).not.toHaveClass(/column-group-destination/);
  await expect(page.locator('ag-grid-angular')).not.toHaveClass(/column-group-hover/);
  await expect(source).toHaveAttribute('aria-colindex', '2');
  const next = await second.boundingBox();
  if (!next) throw new Error('Second destination is missing');
  await page.keyboard.down('Shift');
  await page.mouse.move(next.x + next.width / 2, next.y + next.height / 2);
  await expect(second).toHaveClass(/column-group-destination/);
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await expect(page.locator('app-ungroup-header span')).toHaveText('Revenue + Row ID');
  await expect(page.locator('.ag-dnd-ghost')).toHaveCount(0);
});

for (const side of ['left', 'right'] as const) {
  test(`the cursor must enter the destination's ${side} edge before an immediate drop groups it`, async ({
    page,
  }) => {
    await page.goto('/column-group-demo');
    const sourceId = side === 'left' ? 'id' : 'revenue';
    const source = page.locator(`.ag-header-cell[col-id="${sourceId}"]`);
    const target = page.locator('.ag-header-cell[col-id="name"]');
    const start = await source.boundingBox();
    const destination = await target.boundingBox();
    if (!start || !destination) throw new Error('Headers are missing');
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(start.x + start.width / 2 + 8, start.y + start.height / 2);
    await page.keyboard.down('Shift');
    const x = side === 'left' ? destination.x - 20 : destination.x + destination.width + 4;
    await page.mouse.move(x, destination.y + destination.height / 2);
    const ghost = await page.locator('.ag-dnd-ghost').boundingBox();
    if (!ghost) throw new Error('Floating header is missing');
    expect(
      Math.min(ghost.x + ghost.width, destination.x + destination.width) -
        Math.max(ghost.x, destination.x),
    ).toBeGreaterThan(0);
    await expect(target).not.toHaveClass(/column-group-destination/);
    await expect(page.locator('.column-group-destination')).toHaveCount(0);
    const insideX = side === 'left' ? destination.x + 3 : destination.x + destination.width - 3;
    await page.mouse.move(insideX, destination.y + destination.height / 2);
    await expect(target).toHaveClass(/column-group-destination/);
    await expect(page.locator('.column-group-destination')).toHaveCount(1);
    await expect(page.locator('.ag-header-group-cell')).toHaveCount(0);
    await page.mouse.up();
    await page.keyboard.up('Shift');
    await expect(page.locator('app-ungroup-header span')).toHaveText(
      side === 'left' ? 'Name + Row ID' : 'Name + Revenue',
    );
  });
}

test('entering the full group header highlights it and releasing the mouse groups immediately', async ({
  page,
}) => {
  await page.goto('/column-group-demo');
  await shiftDrag(
    page,
    page.locator('.ag-header-cell[col-id="id"]'),
    page.locator('.ag-header-cell[col-id="name"]'),
  );
  const group = page
    .locator('.ag-header-group-cell')
    .filter({ has: page.locator('app-ungroup-header') });
  const source = page.locator('.ag-header-cell[col-id="revenue"]');
  const start = await source.boundingBox();
  const destination = await group.boundingBox();
  if (!start || !destination) throw new Error('Headers are missing');
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.keyboard.down('Shift');
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + 8, start.y + start.height / 2);
  await page.mouse.move(
    destination.x + destination.width + 4,
    destination.y + destination.height / 2,
  );
  await expect(group).not.toHaveClass(/column-group-destination/);
  await page.mouse.move(
    destination.x + destination.width - 3,
    destination.y + destination.height / 2,
  );
  await expect(group).toHaveClass(/column-group-destination/);
  await expect(page.locator('.column-group-destination')).toHaveCount(1);
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await expect(page.locator('app-ungroup-header span')).toHaveText('Name + Row ID + Revenue');
});

test('the faded grouping border has no animation or scale', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/column-group-demo');
  const source = page.locator('.ag-header-cell[col-id="id"]');
  const target = page.locator('.ag-header-cell[col-id="name"]');
  const start = await source.boundingBox();
  const destination = await target.boundingBox();
  if (!start || !destination) throw new Error('Headers are missing');
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.keyboard.down('Shift');
  await page.mouse.down();
  await page.mouse.move(destination.x + 3, destination.y + destination.height / 2);
  await expect(target).toHaveClass(/column-group-destination/);
  await expect(target).toHaveCSS('animation-name', 'none');
  await expect(target).toHaveCSS('scale', 'none');
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await expect(page.locator('app-ungroup-header span')).toHaveText('Name + Row ID');
});

const groupHeader = (page: Page, id: string) =>
  page
    .locator('.ag-header-group-cell')
    .filter({ has: page.locator(`app-ungroup-header[data-column-group-target="${id}"]`) });
const realGroups = (page: Page) =>
  page.locator('.ag-header-group-cell').filter({ has: page.locator('app-ungroup-header') });

async function initialGroup(page: Page): Promise<void> {
  await page.goto('/column-group-demo');
  await shiftDrag(
    page,
    page.locator('.ag-header-cell[col-id="id"]'),
    page.locator('.ag-header-cell[col-id="name"]'),
  );
}

async function twoGroups(page: Page): Promise<void> {
  await initialGroup(page);
  await shiftDrag(
    page,
    page.locator('.ag-header-cell[col-id="revenue"]'),
    page.locator('.ag-header-cell[col-id="cost"]'),
  );
  await expect(realGroups(page)).toHaveCount(2);
}

const firstGroupId = 'group:name:id';
const secondGroupId = 'group:cost:revenue';
const combinedGroupId = `group:${secondGroupId}:${firstGroupId}`;

for (const gesture of ['Shift', 'middle'] as const) {
  test(`${gesture}-drag combines two groups under a parent and Ungroup separates them intact`, async ({
    page,
  }) => {
    await twoGroups(page);
    const id = page.locator('.ag-header-cell[col-id="id"]');
    await id.click();
    const width = await id.evaluate((element) => element.getBoundingClientRect().width);
    const order = await page.locator('.ag-header-cell[col-id]').evaluateAll((elements) =>
      elements
        .map((element) => ({
          id: element.getAttribute('col-id'),
          index: Number(element.getAttribute('aria-colindex')),
        }))
        .sort((a, b) => a.index - b.index)
        .map((element) => element.id),
    );
    const source = groupHeader(page, firstGroupId).locator('app-ungroup-header span');
    const target = groupHeader(page, secondGroupId);
    if (gesture === 'middle') {
      await page.getByRole('checkbox', { name: 'Middle mouse grouping' }).check();
      await middleDrag(page, source, target);
    } else {
      const start = await source.boundingBox();
      const destination = await target.boundingBox();
      if (!start || !destination) throw new Error('Group headers are missing');
      await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
      await page.keyboard.down('Shift');
      await page.mouse.down();
      await page.mouse.move(start.x + start.width / 2 + 8, start.y + start.height / 2);
      await page.mouse.move(
        destination.x + destination.width / 2,
        destination.y + destination.height / 2,
      );
      await expect(target).toHaveClass(/column-group-destination/);
      await expect(target).toHaveCSS('box-shadow', 'rgba(23, 103, 91, 0.7) 0px 0px 0px 2px inset');
      await expect(page.locator('.ag-dnd-ghost')).toBeVisible();
      await page.mouse.up();
      await page.keyboard.up('Shift');
    }
    await expect(realGroups(page)).toHaveCount(3);
    await expect(groupHeader(page, combinedGroupId)).toBeVisible();
    await expect(groupHeader(page, firstGroupId)).toContainText('Name + Row ID');
    await expect(groupHeader(page, secondGroupId)).toContainText('Cost + Revenue');
    await expect(id).toHaveAttribute('aria-sort', 'ascending');
    expect(await id.evaluate((element) => element.getBoundingClientRect().width)).toBe(width);
    expect(
      await page.locator('.ag-header-cell[col-id]').evaluateAll((elements) =>
        elements
          .map((element) => ({
            id: element.getAttribute('col-id'),
            index: Number(element.getAttribute('aria-colindex')),
          }))
          .sort((a, b) => a.index - b.index)
          .map((element) => element.id),
      ),
    ).toEqual(order);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await groupHeader(page, combinedGroupId)
      .getByRole('button', { name: /^Ungroup/ })
      .click();
    await expect(realGroups(page)).toHaveCount(2);
    await expect(groupHeader(page, firstGroupId)).toBeVisible();
    await expect(groupHeader(page, secondGroupId)).toBeVisible();
    await expect(page.locator('.ag-header-cell[col-id="name"]')).toBeFocused();
    await expect(page.locator('.ag-dnd-ghost, .column-group-destination')).toHaveCount(0);
  });
}

test('Combine groups controls support keyboard use and reject self and ancestor combinations', async ({
  page,
}) => {
  await twoGroups(page);
  const source = page.getByLabel('Group to combine', { exact: true });
  const target = page.getByLabel('Combine with', { exact: true });
  const combine = page.getByRole('button', { name: 'Combine groups', exact: true });
  await source.selectOption(firstGroupId);
  await target.selectOption(firstGroupId);
  await combine.focus();
  await page.keyboard.press('Enter');
  await expect(realGroups(page)).toHaveCount(2);
  await target.selectOption(secondGroupId);
  await combine.focus();
  await page.keyboard.press('Enter');
  await expect(realGroups(page)).toHaveCount(3);
  await expect(combine).toBeFocused();
  await source.selectOption(combinedGroupId);
  await target.selectOption(firstGroupId);
  await combine.focus();
  await page.keyboard.press('Enter');
  await expect(realGroups(page)).toHaveCount(3);
  await expect(page.getByRole('status', { exact: true })).toHaveText(
    'Choose two different groups that do not contain each other.',
  );
  // Sibling groups can form another level without replacing their common parent.
  await source.selectOption(firstGroupId);
  await target.selectOption(secondGroupId);
  await combine.focus();
  await page.keyboard.press('Enter');
  await expect(realGroups(page)).toHaveCount(4);
  await expect(groupHeader(page, `${combinedGroupId}:2`)).toBeVisible();
  await expect(groupHeader(page, combinedGroupId)).toBeVisible();
});

test('Shift can be enabled during a group drag and released to resume ordinary movement', async ({
  page,
}) => {
  await twoGroups(page);
  const source = groupHeader(page, firstGroupId).locator('app-ungroup-header span');
  const target = groupHeader(page, secondGroupId);
  const start = await source.boundingBox();
  const destination = await target.boundingBox();
  if (!start || !destination) throw new Error('Group headers are missing');
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + 8, start.y + start.height / 2);
  await page.keyboard.down('Shift');
  await page.mouse.move(
    destination.x + destination.width / 2,
    destination.y + destination.height / 2,
  );
  await expect(target).toHaveClass(/column-group-destination/);
  await page.keyboard.up('Shift');
  await expect(page.locator('.column-group-destination')).toHaveCount(0);
  await page.mouse.up();
  await expect(realGroups(page)).toHaveCount(2);
  await expect(page.locator('.ag-dnd-ghost')).toHaveCount(0);
});

for (const sourceKind of ['parent', 'child'] as const) {
  test(`dragging a ${sourceKind} group onto its own descendant or ancestor never highlights or combines it`, async ({
    page,
  }) => {
    await twoGroups(page);
    await page.getByLabel('Group to combine', { exact: true }).selectOption(firstGroupId);
    await page.getByLabel('Combine with', { exact: true }).selectOption(secondGroupId);
    await page.getByRole('button', { name: 'Combine groups', exact: true }).click();
    const source = groupHeader(
      page,
      sourceKind === 'parent' ? combinedGroupId : firstGroupId,
    ).locator('app-ungroup-header span');
    const target = groupHeader(page, sourceKind === 'parent' ? firstGroupId : combinedGroupId);
    const start = await source.boundingBox();
    const destination = await target.boundingBox();
    if (!start || !destination) throw new Error('Group headers are missing');
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.keyboard.down('Shift');
    await page.mouse.down();
    await page.mouse.move(start.x + start.width / 2 + 8, start.y + start.height / 2);
    await page.mouse.move(
      destination.x + destination.width / 2,
      destination.y + destination.height / 2,
    );
    await expect(page.locator('.column-group-destination')).toHaveCount(0);
    await page.mouse.up();
    await page.keyboard.up('Shift');
    await expect(realGroups(page)).toHaveCount(3);
    await expect(groupHeader(page, firstGroupId)).toBeVisible();
    await expect(groupHeader(page, secondGroupId)).toBeVisible();
    await expect(groupHeader(page, combinedGroupId)).toBeVisible();
  });
}

test('dropping on a child creates a subgroup and preserves its parent and siblings', async ({
  page,
}) => {
  await initialGroup(page);
  const name = page.locator('.ag-header-cell[col-id="name"]');
  await name.click();
  const width = await name.evaluate((el) => el.getBoundingClientRect().width);
  await shiftDrag(page, page.locator('.ag-header-cell[col-id="revenue"]'), name);
  await expect(realGroups(page)).toHaveCount(2);
  await expect(groupHeader(page, 'group:name:id')).toContainText('Name + Revenue + Row ID');
  await expect(groupHeader(page, 'group:name:revenue')).toContainText('Name + Revenue');
  await expect(name).toHaveAttribute('aria-sort', 'ascending');
  expect(await name.evaluate((el) => el.getBoundingClientRect().width)).toBe(width);
  await expect(page.locator('.ag-header-cell[col-id="id"]')).toHaveCount(1);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  // Removing just the nested level leaves the outer group intact.
  await groupHeader(page, 'group:name:revenue')
    .getByRole('button', { name: /^Ungroup/ })
    .click();
  await expect(realGroups(page)).toHaveCount(1);
  await expect(groupHeader(page, 'group:name:id')).toContainText('Name + Revenue + Row ID');
  await expect(name).toBeFocused();
});

test('siblings can create a subgroup without losing the outer group', async ({ page }) => {
  await initialGroup(page);
  await shiftDrag(
    page,
    page.locator('.ag-header-cell[col-id="id"]'),
    page.locator('.ag-header-cell[col-id="name"]'),
  );
  await expect(realGroups(page)).toHaveCount(2);
  await expect(groupHeader(page, 'group:name:id')).toBeVisible();
  await expect(groupHeader(page, 'group:name:id:2')).toBeVisible();
  await expect(page.locator('.ag-header-cell[col-id="id"]')).toHaveCount(1);
  await expect(page.locator('.ag-header-cell[col-id="name"]')).toHaveCount(1);
});

test('a nested column can join the outer group directly', async ({ page }) => {
  await initialGroup(page);
  await shiftDrag(
    page,
    page.locator('.ag-header-cell[col-id="revenue"]'),
    page.locator('.ag-header-cell[col-id="name"]'),
  );
  await expect(realGroups(page)).toHaveCount(2);
  await shiftDrag(
    page,
    page.locator('.ag-header-cell[col-id="revenue"]'),
    groupHeader(page, 'group:name:id'),
  );
  await expect(realGroups(page)).toHaveCount(1);
  await expect(groupHeader(page, 'group:name:id')).toContainText('Name + Row ID + Revenue');
});

test('moving a child into another group transfers only that column', async ({ page }) => {
  await initialGroup(page);
  await shiftDrag(
    page,
    page.locator('.ag-header-cell[col-id="revenue"]'),
    page.locator('.ag-header-cell[col-id="cost"]'),
  );
  await expect(realGroups(page)).toHaveCount(2);
  await shiftDrag(
    page,
    page.locator('.ag-header-cell[col-id="id"]'),
    groupHeader(page, 'group:cost:revenue'),
  );
  await expect(realGroups(page)).toHaveCount(1);
  await expect(groupHeader(page, 'group:cost:revenue')).toContainText('Cost + Revenue + Row ID');
  await expect(page.locator('.ag-header-cell[col-id="name"]')).toHaveAttribute(
    'aria-colindex',
    '1',
  );
  await expect(page.locator('.ag-header-cell[col-id]')).toHaveCount(10);
});

test('Shift-dragging a child below the headers ungroups it and preserves its new position', async ({
  page,
}) => {
  await initialGroup(page);
  const source = page.locator('.ag-header-cell[col-id="id"]');
  await source.focus();
  await page.keyboard.press('Enter');
  await expect(source).toHaveAttribute('aria-sort', 'ascending');
  const width = await source.evaluate((el) => el.getBoundingClientRect().width);
  await shiftDetach(page, source, page.locator('.ag-header-cell[col-id="cost"]'));
  await expect(realGroups(page)).toHaveCount(0);
  await expect(source).toHaveAttribute('aria-sort', 'ascending');
  expect(await source.evaluate((el) => el.getBoundingClientRect().width)).toBe(width);
  await expect
    .poll(async () => Number(await source.getAttribute('aria-colindex')))
    .toBeGreaterThan(2);
  await expect(page.locator('.ag-header-cell[col-id]')).toHaveCount(10);
});

test('Shift-dragging a nested child out preserves its remaining parent and siblings', async ({
  page,
}) => {
  await initialGroup(page);
  await shiftDrag(
    page,
    page.locator('.ag-header-cell[col-id="revenue"]'),
    page.locator('.ag-header-cell[col-id="name"]'),
  );
  const source = page.locator('.ag-header-cell[col-id="revenue"]');
  await shiftDetach(page, source, page.locator('.ag-header-cell[col-id="quantity"]'));
  await expect(realGroups(page)).toHaveCount(1);
  await expect(groupHeader(page, 'group:name:id')).toContainText('Name + Row ID');
  await expect
    .poll(async () => Number(await source.getAttribute('aria-colindex')))
    .toBeGreaterThan(3);
  await expect(page.locator('.ag-header-cell[col-id]')).toHaveCount(10);
});

test('normal dragging within a group keeps the column in that group', async ({ page }) => {
  await initialGroup(page);
  await shiftDrag(
    page,
    page.locator('.ag-header-cell[col-id="revenue"]'),
    groupHeader(page, 'group:name:id'),
  );
  await page
    .locator('.ag-header-cell[col-id="id"]')
    .dragTo(page.locator('.ag-header-cell[col-id="name"]'), { targetPosition: { x: 15, y: 22 } });
  await expect(realGroups(page)).toHaveCount(1);
  await expect(groupHeader(page, 'group:name:id')).toBeVisible();
  await expect(page.locator('.ag-header-cell[col-id="id"]')).toHaveAttribute('aria-colindex', '1');
});

test('subgroups can nest again and a group header still accepts a direct child', async ({
  page,
}) => {
  await initialGroup(page);
  await shiftDrag(
    page,
    page.locator('.ag-header-cell[col-id="revenue"]'),
    page.locator('.ag-header-cell[col-id="name"]'),
  );
  await shiftDrag(
    page,
    page.locator('.ag-header-cell[col-id="cost"]'),
    page.locator('.ag-header-cell[col-id="name"]'),
  );
  await expect(realGroups(page)).toHaveCount(3);
  await expect(groupHeader(page, 'group:name:cost')).toBeVisible();
  await shiftDrag(
    page,
    page.locator('.ag-header-cell[col-id="quantity"]'),
    groupHeader(page, 'group:name:revenue'),
  );
  await expect(realGroups(page)).toHaveCount(3);
  await expect(groupHeader(page, 'group:name:revenue')).toContainText(
    'Name + Cost + Revenue + Quantity',
  );
  await expect(page.locator('.ag-header-cell[col-id]')).toHaveCount(10);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Ungroup columns', exact: true }).click();
  await expect(realGroups(page)).toHaveCount(0);
  await expect(page.locator('.ag-header-cell[col-id]')).toHaveCount(10);
});

async function shiftDetach(page: Page, source: Locator, target: Locator): Promise<void> {
  await source.hover();
  const start = await source.boundingBox();
  const destination = await target.boundingBox();
  if (!start || !destination) throw new Error('Headers are missing');
  await page.keyboard.down('Shift');
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + 8, start.y + start.height / 2);
  await page.mouse.move(
    destination.x + destination.width - 5,
    destination.y + destination.height + 25,
  );
  await page.mouse.up();
  await page.keyboard.up('Shift');
}

test('children remain married when dragged outside their group without Shift', async ({ page }) => {
  await initialGroup(page);
  const source = page.locator('.ag-header-cell[col-id="id"]');
  const target = page.locator('.ag-header-cell[col-id="cost"]');
  await source.dragTo(target, { targetPosition: { x: 145, y: 22 } });
  await expect(realGroups(page)).toHaveCount(1);
  await expect(groupHeader(page, 'group:name:id')).toBeVisible();
  const first = Number(
    await page.locator('.ag-header-cell[col-id="name"]').getAttribute('aria-colindex'),
  );
  const second = Number(await source.getAttribute('aria-colindex'));
  expect(Math.abs(first - second)).toBe(1);
});

test('releasing Shift before a drag-out drop keeps children married', async ({ page }) => {
  await initialGroup(page);
  const source = page.locator('.ag-header-cell[col-id="id"]');
  const target = page.locator('.ag-header-cell[col-id="cost"]');
  const start = await source.boundingBox();
  const destination = await target.boundingBox();
  if (!start || !destination) throw new Error('Headers are missing');
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + 8, start.y + start.height / 2);
  await page.keyboard.down('Shift');
  await page.mouse.move(
    destination.x + destination.width - 5,
    destination.y + destination.height + 25,
  );
  await page.keyboard.up('Shift');
  await page.mouse.up();
  await expect(realGroups(page)).toHaveCount(1);
  await expect(groupHeader(page, 'group:name:id')).toBeVisible();
});
