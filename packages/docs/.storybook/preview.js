import { initialize, mswLoader } from 'msw-storybook-addon';

import '../src/styles.css';

initialize();

/**
 * @type {import('@storybook/react').Preview}
 */
const preview = {
  parameters: {
    options: {
      storySort: {
        order: ['Guides', ['Introduction', 'Installation'], 'Demos', ['Urql']],
      },
    },
    previewTabs: {
      'storybook/docs/panel': {
        hidden: true,
      },
    },
    actions: { argTypesRegex: '^on[A-Z].*' },
  },
  loaders: [mswLoader]
};

export default preview;

