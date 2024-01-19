import { defineConfig } from 'tsup'

const browser = defineConfig({
  entry: {
    'index.browser': './src/index.ts',
  },
  outDir: './dist',
  target: ['chrome112'],
  format: 'cjs',
  esbuildOptions(options) {
    options.alias = {
      ...(options.alias || {}),
      '@build-time/initialize': './src/initialize.browser.ts',
    }
  },
  bundle: true,
  dts: true,
  tsconfig: './tsconfig.browser.json',
})

const node = defineConfig({
  entry: {
    'index.node': './src/index.ts',
  },
  outDir: './dist',
  target: 'node18',
  format: 'cjs',
  esbuildOptions(options) {
    options.alias = {
      ...(options.alias || {}),
      '@build-time/initialize': './src/initialize.node.ts',
    }
  },
  bundle: true,
  dts: true,
  tsconfig: './tsconfig.node.json',
})

const reactNative = defineConfig({
  entry: {
    'index.react-native': './src/index.ts',
  },
  outDir: './dist',
  target: 'esnext',
  format: 'cjs',
  esbuildOptions(options) {
    options.alias = {
      ...(options.alias || {}),
      '@build-time/initialize': './src/initialize.react-native.ts',
    }
  },
  bundle: true,
  dts: true,
  tsconfig: './tsconfig.react-native.json',
})

export default [browser, node, reactNative]
