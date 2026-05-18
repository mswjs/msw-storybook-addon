import { defineConfig } from 'tsdown'

export default defineConfig({
  // `shared-state.ts` is an explicit entry so it's one shared chunk —
  // `./` and `initialize()` must see the same singletons at runtime.
  entry: [
    './src/index.ts',
    './src/csf3.ts',
    './src/preview.ts',
    './src/shared-state.ts',
    './src/types.ts',
  ],
  outDir: './build',
  format: ['esm'],
  dts: true,
  clean: true,
})
