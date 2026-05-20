import { defineConfig } from '@playwright/test'

const DEFAULT_PORT = 56789
const CSF3_PORT = 56790

export default defineConfig({
  testMatch: '*.test.ts',
  timeout: 5000,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
    serviceWorkers: 'allow',
  },
  projects: [
    {
      name: 'factory',
      testDir: './tests/factory',
      use: {
        baseURL: `http://localhost:${DEFAULT_PORT}/`,
      },
    },
    {
      name: 'csf3',
      testDir: './tests/csf3',
      use: {
        baseURL: `http://localhost:${CSF3_PORT}/`,
      },
    },
  ],
  webServer: [
    {
      command: `pnpm storybook -p ${DEFAULT_PORT}`,
      port: DEFAULT_PORT,
      reuseExistingServer: true,
    },
    {
      command: `pnpm storybook:csf3 -p ${CSF3_PORT}`,
      port: CSF3_PORT,
      reuseExistingServer: true,
    },
  ],
})
