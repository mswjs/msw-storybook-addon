import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    entry: ['./src/index.ts', './src/preview.ts', './src/csf3.ts'],
    outDir: './build',
    format: ['esm'],
    dts: true,
    clean: true
  },
  // For the `msw-storybook-migrate` command
  {
    entry: { migrate: './codemod/src/bin.ts' },
    outDir: './build',
    format: ['esm'],
    platform: 'node',
    dts: false,
    clean: false
  }
])
