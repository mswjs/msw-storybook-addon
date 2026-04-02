import { defineConfig } from '@playwright/test'

const PORT = 56789

export default defineConfig({
  testDir: './tests',
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
    command: `pnpm storybook -p ${PORT}`,
    port: PORT,
    reuseExistingServer: true,
  },
})
