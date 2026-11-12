import { defineConfig, devices } from '@playwright/test';

/** Browser tests drive the real client against the local API (dev/server.ts). */
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    ...devices['Pixel 7'],
    deviceScaleFactor: 1,
  },
  webServer: [
    {
      command: 'npm run dev:api',
      url: 'http://localhost:8787/dev/post',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: 'npm run dev:web',
      url: 'http://localhost:5173/splash.html',
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
