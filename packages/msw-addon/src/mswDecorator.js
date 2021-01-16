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
    let handlers = parameters;

    const isFunc = typeof parameters === 'function';
    if (isFunc) {
      handlers = parameters(context.args);
    }

    handlers = handlers || [];

    if (worker) {
      worker.resetHandlers();
      worker.use(...handlers);
    }
    return storyFn(context);
  },
});
