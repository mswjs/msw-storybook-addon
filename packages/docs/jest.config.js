module.exports = {
  clearMocks: false,
  moduleFileExtensions: [
    'web.js',
    'js',
    'web.ts',
    'ts',
    'web.tsx',
    'tsx',
    'json',
    'web.jsx',
    'jsx',
    'node',
  ],
  moduleNameMapper: { '^.+\\.module\\.(css|sass|scss)$': 'identity-obj-proxy' },
  resetMocks: true,
  resetModules: false,
  restoreMocks: false,
  setupFiles: ['./src/fetch-polyfill.js'],
  setupFilesAfterEnv: ['./src/setupTests.js'],
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.(js|jsx|mjs|cjs|ts|tsx)$':
      '/Users/mattcosta7/msw-storybook-addon/node_modules/react-scripts/config/jest/babelTransform.js',
    '^.+\\.css$':
      '/Users/mattcosta7/msw-storybook-addon/node_modules/react-scripts/config/jest/cssTransform.js',
    '^(?!.*\\.(js|jsx|mjs|cjs|ts|tsx|css|json)$)':
      '/Users/mattcosta7/msw-storybook-addon/node_modules/react-scripts/config/jest/fileTransform.js',
  },
  transformIgnorePatterns: ['node_modules/(?!@bundled-es-modules)/'],
}
