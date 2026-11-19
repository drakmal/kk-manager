import { defineConfig, devices } from '@playwright/test';

// Headless only, GPU off: nothing is drawn on screen and the GPU isn't used.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: 0,
  reporter: 'line',
  use: {
    baseURL: 'http://localhost:4173/kk-manager/',
    headless: true,
    viewport: { width: 1280, height: 800 },
    launchOptions: { args: ['--disable-gpu'] },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } }],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/kk-manager/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
