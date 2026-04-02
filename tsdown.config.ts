import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts'],
  outDir: './build',
  format: ['esm'],
  dts: true,
  clean: true,
})
