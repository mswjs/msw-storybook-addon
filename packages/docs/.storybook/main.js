const path = require('path')
/**
 * @type {import('@storybook/react-webpack5').StorybookConfig}
 */
const config = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-a11y',
    '@storybook/preset-create-react-app',
  ],
  staticDirs: ['../public'],
  webpackFinal: async (config) => {
    config.resolve = config.resolve || {}
    config.resolve.alias = {
      ...config.resolve.alias,
      'msw/native': require.resolve(
        path.resolve(__dirname, '../../../node_modules/msw/lib/native/index.mjs')
      ),
      'msw-storybook-addon': require.resolve('../../msw-addon/dist'),
    }
    return config
  },
  framework: {
    name: '@storybook/react-webpack5',
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
}

export default config
