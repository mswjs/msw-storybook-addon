import { defineConfig } from 'tsup'

const browser = defineConfig({
  entry: {
    'index.browser': './src/index.new.ts',
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
})

const node = defineConfig({
  entry: {
    'index.node': './src/index.new.ts',
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
})

const reactNative = defineConfig({
  entry: {
    'index.react-native': './src/index.new.ts',
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
})

export default [browser, node, reactNative]
