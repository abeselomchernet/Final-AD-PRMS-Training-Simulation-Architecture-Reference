import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const explicitChromiumPath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim() || undefined;
if (explicitChromiumPath && !fs.existsSync(explicitChromiumPath)) {
  throw new Error(
    `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH does not exist: ${explicitChromiumPath}`
  );
}

const chromiumLaunchOptions = explicitChromiumPath
  ? { executablePath: explicitChromiumPath }
  : undefined;
const playwrightDbPath = path.join(os.tmpdir(), 'adprms-playwright.db');

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(chromiumLaunchOptions ? { launchOptions: chromiumLaunchOptions } : {}),
      },
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        ...(chromiumLaunchOptions ? { launchOptions: chromiumLaunchOptions } : {}),
      },
    },
    {
      // Playwright WebKit with iPhone 13 device emulation tests WebKit layout and
      // touch semantics, not Apple's actual Safari browser on physical iOS hardware.
      // Never apply Chromium executable paths or launchOptions to this project.
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
    },
  ],
  webServer: {
    command: `NODE_ENV=production PORT=4173 ADPRMS_E2E_HARNESS=1 ADPRMS_E2E_AUTH_RATE_LIMIT_MAX=120 OFFICE_DB_PATH=${JSON.stringify(playwrightDbPath)} npx tsx tests/e2e/playwright-webserver.ts`,
    url: 'http://127.0.0.1:4173/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
