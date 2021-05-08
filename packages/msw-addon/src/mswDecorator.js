import { setupWorker } from 'msw';
import { setupServer } from 'msw/node';

let worker;

const IS_BROWSER = typeof global.process === 'undefined'

export function initializeWorker(options) {
  if (IS_BROWSER) {
    worker = setupWorker();
    worker.start(options);
  } else {
    worker = setupServer();
    worker.listen(options);
  }
}

export function getWorker() {
  if(worker === undefined) {
    throw new Error(`[MSW] Tried to get worker but it was not defined yet. Did you forget to initialize it?`)
  }

  return worker;
}

export const mswDecorator = (storyFn, { parameters: { msw = [] } }) => {
  if (worker) {
    worker.resetHandlers();

    if (Array.isArray(msw)) {
      if (msw.length > 0) {
        worker.use(...msw);
      }
    } else {
      throw new Error(`[MSW] expected to receive an array of handlers but received "${typeof msw}" instead.
        Please refer to the documentation: https://mswjs.io/docs/getting-started/mocks/rest-api`)
    }
  }

  return storyFn();
};
