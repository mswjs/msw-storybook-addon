import { initialize, mswLoader } from 'msw-storybook-addon';

import '../src/styles.css';

initialize();

/**
 * @type {import('@storybook/react').Preview}
 */
const preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
  },
  loaders: [mswLoader]
};

export default preview;

