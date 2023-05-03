import { defineConfig } from 'tsup'

export default defineConfig((options) => ({
  entry: ['src/index.ts'],
  splitting: false,
  minify: false,
  format: ['cjs', 'esm'],
  dts: {
    resolve: true,
  },
  treeshake: true,
  clean: true,
  platform: 'browser',
  esbuildOptions(options) {
    options.conditions = ['module']
  },
}))
