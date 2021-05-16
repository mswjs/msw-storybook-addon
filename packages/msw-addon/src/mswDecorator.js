import { initializeWorkerInstance } from './initializeWorker';

let worker;

export function initializeWorker(options) {
  worker = initializeWorkerInstance()
  worker.start(options)

  return worker
}

export function getWorker() {
  if (worker === undefined) {
    throw new Error(`[MSW] Tried to get worker but it was not defined yet. Did you forget to initialize it?`)
  }

  return worker;
}

export const mswDecorator = (storyFn, { parameters: { msw = [] } }) => {
  if (worker) {
    worker.resetHandlers();

    if (!Array.isArray(msw)) {
      throw new Error(`[MSW] expected to receive an array of handlers but received "${typeof msw}" instead.
        Please refer to the documentation: https://mswjs.io/docs/getting-started/mocks/rest-api`)
    }

    if (msw.length > 0) {
      worker.use(...msw);
    }
  }

  return storyFn();
};
