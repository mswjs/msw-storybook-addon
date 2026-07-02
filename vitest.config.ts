import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'factory',
          typecheck: {
            enabled: true,
            only: true,
            include: ['tests/factory/**/*.test-d.ts'],
            tsconfig: './tests/factory/tsconfig.json'
          }
        }
      },
      {
        test: {
          name: 'csf3',
          typecheck: {
            enabled: true,
            only: true,
            include: ['tests/csf3/**/*.test-d.ts'],
            tsconfig: './tests/csf3/tsconfig.json'
          }
        }
      }
    ]
  }
})
