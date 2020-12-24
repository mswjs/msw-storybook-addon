import { makeDecorator } from '@storybook/addons';
import { setupWorker } from 'msw';

let worker;

export function initializeWorker() {
  if (typeof global.process === 'undefined') {
    worker = setupWorker();
    worker.start();
  }
}

export const mswDecorator = makeDecorator({
  name: 'withMsw',
  parameterName: 'msw',
  wrapper: (storyFn, context, { parameters }) => {
    if (worker) {
      worker.use(...parameters);
    }
    return storyFn(context);
  },
});
