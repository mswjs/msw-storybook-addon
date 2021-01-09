import { addDecorator } from '@storybook/react';
import { initializeWorker, mswDecorator } from 'msw-storybook-addon';
import { withResponsiveViews } from 'storybook-addon-responsive-views';

import '../src/styles.css';

initializeWorker();
addDecorator(mswDecorator);
addDecorator(
  withResponsiveViews({
    mobile: 425,
    tablet: 750,
    desktop: 1000,
  }),
);

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
