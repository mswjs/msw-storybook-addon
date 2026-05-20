import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    './src/index.ts',
    './src/preview.ts',
    './src/types.ts',
    './src/csf3/index.ts',
  ],
  outDir: './build',
  format: ['esm'],
  dts: true,
  clean: true,
})
