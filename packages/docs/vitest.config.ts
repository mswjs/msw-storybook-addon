/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import { mergeConfig } from 'vite'

import viteConfig from './vite.config'

// https://vitejs.dev/config/
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      clearMocks: true,
      setupFiles: './src/setupTests.js',
    },
  })
)
