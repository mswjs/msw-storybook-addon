import { defineConfig } from 'vitest/config'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        root: './tests/base',
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
        plugins: [
          storybookTest({
            configDir: new URL('./.storybook', import.meta.url).pathname,
            storybookScript: 'pnpm storybook -- --no-open',
          }),
        ],
      },
    ],
  },
})
