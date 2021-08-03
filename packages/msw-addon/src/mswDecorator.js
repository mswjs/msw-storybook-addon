let api

const IS_BROWSER = typeof global.process === 'undefined'

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
    const { setupServer } = require('msw/node')
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
        // support Array of handlers
        api.use(...msw);
      } else {
        // support object of named arrays
        const handlers = Object.values(msw).filter(Boolean).reduce((acc, arr) => acc.concat(arr), []);

        if (handlers.length > 0) {
          api.use(...handlers)
        }
      }
    }
  }

  return storyFn()
}
