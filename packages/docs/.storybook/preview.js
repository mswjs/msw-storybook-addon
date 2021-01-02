import { addDecorator } from '@storybook/react';
import { setup } from 'twind';
import { initializeWorker, mswDecorator } from 'msw-storybook-addon';

import '../src/styles.css';

initializeWorker();
addDecorator(mswDecorator);

setup({
  preflight: false,
});

export const parameters = {
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
};
