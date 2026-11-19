import { defineConfig, devices } from '@playwright/test';

// Headless only, GPU off: nothing is drawn on screen and the GPU isn't used.
// E2E_PORT lets the tests run while someone is already using `npm run preview` on 4173.
const port = Number(process.env.E2E_PORT ?? 4173);

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: 0,
  reporter: 'line',
  use: {
    baseURL: `http://localhost:${port}/kk-manager/`,
    headless: true,
    viewport: { width: 1280, height: 800 },
    launchOptions: { args: ['--disable-gpu'] },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } }],
  webServer: {
    command: `npm run build && npm run preview -- --port ${port} --strictPort`,
    url: `http://localhost:${port}/kk-manager/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
