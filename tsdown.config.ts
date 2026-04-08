import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts', './src/preview.ts'],
  outDir: './build',
  format: ['esm'],
  dts: true,
  clean: true,
})
