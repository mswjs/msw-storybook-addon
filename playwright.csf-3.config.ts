import { defineConfig } from '@playwright/test'

// CSF3 suite — separate Storybook instance/port because its preview/main
// config (addon via `main.ts addons`) is incompatible with the base
// (factories) setup.
const PORT = 56790

export default defineConfig({
  testDir: './tests/csf-3',
  testMatch: '*.test.ts',
  timeout: 5000,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}/`,
    trace: 'on-first-retry',
    serviceWorkers: 'allow',
  },
  webServer: {
    command: `pnpm storybook:csf-3 -p ${PORT}`,
    port: PORT,
    reuseExistingServer: true,
  },
})
