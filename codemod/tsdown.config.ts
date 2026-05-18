import { defineConfig } from 'tsdown'

// Codemod build. Emits a Node CLI binary plus the three transform
// entries (each is a pure function, importable from automigration tools
// later if needed).
export default defineConfig({
  entry: [
    './src/bin.ts',
    './src/transforms/stories.ts',
    './src/transforms/preview.ts',
    './src/transforms/main.ts',
  ],
  outDir: './dist',
  format: ['esm'],
  platform: 'node',
  target: 'node18',
  dts: false,
  clean: true,
  deps: {
    // Storybook is a peer of the addon; never bundle it.
    neverBundle: ['storybook'],
  },
})
