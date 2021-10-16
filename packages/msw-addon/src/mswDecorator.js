import { isNodeProcess } from 'is-node-process'

const IS_BROWSER = !isNodeProcess()
let api

export function initializeWorker(options) {
  console.warn(
    `[MSW] "initializeWorker" is now deprecated, please use "initialize" instead. This method will be removed in future releases.`
  )
  return initialize(options)
}

export function initialize(options) {
  if (IS_BROWSER) {
    const { setupWorker } = require('msw')
    const worker = setupWorker()
    worker.start(options)
    api = worker
  } else {
    /**
     * Webpack 5 does not provide node polyfills as it did before.
     * Also, it can't tell whether a code will be executed at runtime, so it has to process everything. This branch of the conditional statement will NEVER run in the browser, but Webpack can't know so it breaks builds unless we start providing node polyfills.
     * 
     * As a workaround, we use __non_webpack_require__ to tell Webpack to ignore this, and we define it to globalThis so it works correctly when running in node.
     * See https://github.com/webpack/webpack/issues/8826#issuecomment-660594260
     */
    globalThis.__non_webpack_require__ = require
    const { setupServer } = __non_webpack_require__('msw/node')
    const server = setupServer()
    server.listen(options)
    api = server
  }

  return api
}

export function getWorker() {
  if (api === undefined) {
    throw new Error(
      `[MSW] Failed to retrieve the worker: no active worker found. Did you forget to call "initialize"?`
    )
  }

  return api
}

export const mswDecorator = (storyFn, { parameters: { msw } }) => {
  if (api) {
    api.resetHandlers()

    if (msw) {
      if (Array.isArray(msw) && msw.length > 0) {
        // support Array of handlers (backwards compatability)
        api.use(...msw);
      } else if (msw.handlers) {
        // support an array named handlers
        // or an Object named handlers with named arrays of handlers
        const handlers = Object.values(msw.handlers).filter(Boolean).reduce((acc, arr) => acc.concat(arr), []);

        if (handlers.length > 0) {
          api.use(...handlers)
        }
      }
    }
  }

  return storyFn()
}
