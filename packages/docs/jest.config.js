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
  moduleNameMapper: {
    '^.+\\.module\\.(css|sass|scss)$': 'identity-obj-proxy',
    '^msw-storybook-addon$': '<rootDir>/../msw-addon/dist/index.node.js',
  },
  resetMocks: true,
  resetModules: false,
  restoreMocks: false,
  setupFiles: ['./src/fetch-polyfill.js'],
  setupFilesAfterEnv: ['./src/setupTests.js'],
  testEnvironment: 'jsdom',
  testEnvironmentOptions: {
    customExportConditions: [''],
  },
  transform: {
    '^.+\\.(js|jsx|mjs|cjs|ts|tsx)$': 'react-scripts/config/jest/babelTransform.js',
    '^.+\\.css$': 'react-scripts/config/jest/cssTransform.js',
    '^(?!.*\\.(js|jsx|mjs|cjs|ts|tsx|css|json)$)': 'react-scripts/config/jest/fileTransform.js',
  },
  transformIgnorePatterns: ['node_modules/(?!@bundled-es-modules)/'],
}
