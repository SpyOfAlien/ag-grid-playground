import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './browser',
  outputDir: './test-results',
  use: {
    baseURL: 'http://localhost:4301',
    viewport: { width: 1700, height: 1000 },
    browserName: 'chromium',
    channel: 'chrome',
  },
  webServer: {
    command: '../../node_modules/.bin/ng serve --host 127.0.0.1',
    url: 'http://localhost:4301',
    reuseExistingServer: true,
  },
});
