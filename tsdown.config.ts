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
    clean: true
  },
  // For the `npx msw-storybook-addon migrate` command. The codemod's parser
  // and printer (Babel, recast) are bundled in, hence the minification.
  {
    entry: { migrate: './codemod/src/bin.ts' },
    outDir: './build',
    format: ['esm'],
    platform: 'node',
    dts: false,
    clean: false,
    minify: true
  }
])
