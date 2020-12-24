import { addDecorator } from '@storybook/react';
import { initializeWorker, mswDecorator } from '../src/mswDecorator';

initializeWorker();
addDecorator(mswDecorator);

export const parameters = {
  actions: { argTypesRegex: '^on[A-Z].*' },
};
