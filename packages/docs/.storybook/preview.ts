import { Preview } from '@storybook/react'
import { initialize, mswLoader } from 'msw-storybook-addon';

import '../src/styles.css';

initialize();

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
  },
  loaders: [mswLoader],
};

export default preview;

