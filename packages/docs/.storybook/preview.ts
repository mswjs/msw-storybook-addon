import { Preview } from '@storybook/react'
import { initialize, mswLoader } from 'msw-storybook-addon';

import '../src/styles.css';

const preview: Preview = {
  // beforeAll is available in Storybook 8.2. Else the call would happen outside of the preview object
  beforeAll: async() => {
    initialize();
  },
  loaders: mswLoader,
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
  },
};

export default preview;

