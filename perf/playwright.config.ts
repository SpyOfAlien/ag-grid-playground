import { defineConfig } from '@playwright/test';

// Timing benchmarks. Run with `npx playwright test -c perf/playwright.config.ts`; not part of
// `test:e2e`, because the numbers depend on the machine.
export default defineConfig({
  testDir: '.',
  timeout: 600_000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env['PERF_BASE_URL'] ?? 'http://127.0.0.1:4200',
    viewport: { width: 1600, height: 1000 },
    channel: process.env['PLAYWRIGHT_CHANNEL'] ?? 'chrome',
  },
  webServer: process.env['PERF_BASE_URL']
    ? undefined
    : {
        command: 'npm start -- --host 127.0.0.1 --port 4200',
        url: 'http://127.0.0.1:4200',
        reuseExistingServer: !process.env['CI'],
        timeout: 120_000,
      },
});
