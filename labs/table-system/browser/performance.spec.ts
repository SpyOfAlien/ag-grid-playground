import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { arch, cpus, platform, release } from 'node:os';
test('records repeatable display baseline, scrolling, signal changes and editor cycles', async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  const runs: Record<string, unknown>[] = [];
  for (const baseline of [true, false]) {
    for (let run = 0; run < 3; run++) {
      await page.goto(baseline ? '/?baseline=1' : '/');
      await expect(page.getByRole('gridcell').first()).toBeVisible();
      const initial = await page.evaluate(() => ({
        elapsedFromNavigationMs: performance.now(),
        renderedCells: document.querySelectorAll('[role="gridcell"]').length,
        visibleCells: Array.from(document.querySelectorAll('[role="gridcell"]')).filter((cell) => {
          const bounds = document.querySelector('.ag-grid-viewport')!.getBoundingClientRect();
          const rect = cell.getBoundingClientRect();
          return rect.bottom > bounds.top && rect.top < bounds.bottom;
        }).length,
      }));
      const scroll = await page.locator('.ag-grid-viewport').evaluate(async (element) => {
        const frames: number[] = [];
        let previous = performance.now();
        const start = previous;
        for (let i = 0; i < 120; i++) {
          element.scrollTop = (i * 331) % 36000;
          await new Promise<void>((r) => requestAnimationFrame(() => r()));
          const current = performance.now();
          frames.push(current - previous);
          previous = current;
        }
        element.scrollTop = 0;
        return {
          elapsedMs: performance.now() - start,
          frameP95Ms: [...frames].sort((a, b) => a - b)[Math.floor(frames.length * 0.95)],
          renderedCells: document.querySelectorAll('[role="gridcell"]').length,
          visibleCells: Array.from(document.querySelectorAll('[role="gridcell"]')).filter(
            (cell) => {
              const bounds = document.querySelector('.ag-grid-viewport')!.getBoundingClientRect();
              const rect = cell.getBoundingClientRect();
              return rect.bottom > bounds.top && rect.top < bounds.bottom;
            },
          ).length,
        };
      });
      const signals = await page.evaluate(async () => {
        const button = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
          (b) => b.textContent === 'Change precision',
        )!;
        const start = performance.now();
        for (let i = 0; i < 30; i++) {
          button.click();
          await new Promise<void>((r) => requestAnimationFrame(() => r()));
        }
        return { elapsedMs: performance.now() - start, changes: 30 };
      });
      runs.push({
        configuration: baseline ? 'reconstructed-phase-1-display' : 'complete-system',
        run,
        initial,
        scroll,
        signals,
      });
    }
  }
  await page.goto('/');
  const cycleStart = Date.now();
  for (let i = 0; i < 20; i++) {
    await page.getByRole('button', { name: 'Edit amount item-0', exact: true }).click();
    await expect(page.getByRole('spinbutton', { name: 'Amount in kg' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('.cdk-overlay-pane')).toHaveCount(0);
  }
  const editorCycles = {
    count: 20,
    elapsedIncludingPlaywrightMs: Date.now() - cycleStart,
    remainingPanes: await page.locator('.cdk-overlay-pane').count(),
  };
  const result = {
    timestamp: new Date().toISOString(),
    environment: {
      os: `${platform()} ${release()}`,
      architecture: arch(),
      cpu: cpus()[0]?.model,
      browser: browser.version(),
      userAgent: await page.evaluate(() => navigator.userAgent),
      viewport: page.viewportSize(),
      mode: 'Angular development server',
      fixtureRows: 1000,
    },
    baselineLimitation:
      'Phase 1 historical timings were not captured. The two-column Phase 1 display configuration is reconstructed in the current application; this measures rendering cost, not historical bundle/bootstrap regression.',
    sequence:
      'Navigate, wait first grid cell, 120 requestAnimationFrame scrolling steps of 331 px modulo 36000, return to top, 30 precision signal changes at one per frame; repeat three times per configuration. Then 20 open/Escape cycles.',
    runs,
    editorCycles,
  };
  writeFileSync(resolve('performance-results.json'), JSON.stringify(result, null, 2));
  expect(editorCycles.remainingPanes).toBe(0);
});
