import { defineConfig } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const production = process.env.E2E_PRODUCTION === '1';
const url = production ? 'http://127.0.0.1:4318' : 'http://127.0.0.1:5173';
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: url,
    headless: true,
    actionTimeout: 10000,
    viewport: { width: 1440, height: 1050 },
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox'],
    },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: production ? 'npm start' : 'npm run dev',
    url,
    reuseExistingServer: false,
    env: { STUDIES_DATA_DIR: mkdtempSync(join(tmpdir(), 'cronograma-e2e-')) },
    timeout: 30000,
  },
});
