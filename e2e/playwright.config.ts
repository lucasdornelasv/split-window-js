import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end scenarios over the demo app. They only use roles and `data-*` attributes, so they
 * can run against the demo apps of future adapters (set DEMO_URL and DEMO_COMMAND).
 */
const port = Number(process.env['DEMO_PORT'] ?? 4300);
const baseURL = process.env['DEMO_URL'] ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    viewport: { width: 1600, height: 900 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 900 } },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], viewport: { width: 1600, height: 900 } },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], viewport: { width: 1600, height: 900 } },
    },
  ],
  webServer: process.env['DEMO_URL']
    ? undefined
    : {
        command: process.env['DEMO_COMMAND'] ?? `npx ng serve demo-angular --port ${port}`,
        cwd: '..',
        url: baseURL,
        reuseExistingServer: !process.env['CI'],
        timeout: 180_000,
      },
});
