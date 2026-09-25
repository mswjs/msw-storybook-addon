import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    entry: [
      './src/index.ts',
      './src/preview.ts',
      './src/types.ts',
      './src/csf3.ts'
    ],
    outDir: './build',
    format: ['esm'],
    dts: true,
    clean: true,
    // Provided by the `msw/vite` plugin in the consumer project.
    external: ['virtual:msw']
  },
  // For the `npx msw-storybook-addon migrate` command
  {
    entry: { migrate: './codemod/src/bin.ts' },
    outDir: './build',
    format: ['esm'],
    platform: 'node',
    dts: false,
    clean: false
  }
])
