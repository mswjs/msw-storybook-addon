module.exports = {
  stories: ['../src/**/*.stories.mdx', '../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-a11y',
    '@storybook/preset-create-react-app',
    '@storybook/addon-storysource',
  ],
  webpackFinal: async (config) => {
    config.resolve = config.resolve || {}
    config.resolve.alias = {
      ...config.resolve.alias,
      'msw-storybook-addon': require.resolve('../../msw-addon/dist'),
    }
    return config
  },
  core: {
    builder: 'webpack5',
  },
}
