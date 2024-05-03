import { defineConfig, Options } from 'tsup'

const commonOptions: Partial<Options> = {
  outDir: './dist',
  clean: true,
  format: 'esm',
  bundle: true,
  dts: true,
}

const browser = defineConfig({
  ...commonOptions,
  entry: {
    'index.browser': './src/index.ts',
  },
  target: ['chrome112'],
  esbuildOptions(options) {
    options.alias = {
      ...(options.alias || {}),
      '@build-time/initialize': './src/initialize.browser.ts',
    }
  },
  tsconfig: './tsconfig.browser.json',
})

const node = defineConfig({
  ...commonOptions,
  entry: {
    'index.node': './src/index.ts',
  },
  target: 'node18',
  format: 'cjs',
  esbuildOptions(options) {
    options.alias = {
      ...(options.alias || {}),
      '@build-time/initialize': './src/initialize.node.ts',
    }
  },
  tsconfig: './tsconfig.node.json',
})

const reactNative = defineConfig({
  ...commonOptions,
  entry: {
    'index.react-native': './src/index.ts',
  },
  target: 'esnext',
  esbuildOptions(options) {
    options.alias = {
      ...(options.alias || {}),
      '@build-time/initialize': './src/initialize.react-native.ts',
    }
  },
  tsconfig: './tsconfig.react-native.json',
})

export default [browser, node, reactNative]
