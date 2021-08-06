let api

const IS_BROWSER = typeof global.process === 'undefined'

export function initializeWorker(options) {
  console.warn(
    `[MSW] "initializeWorker" is now deprecated, please use "initialize" instead. This method will be removed in future releases.`
  )
  return initialize(options)
}

export function initialize(options, handlers = []) {
  if (IS_BROWSER) {
    const { setupWorker } = require('msw')
    const worker = setupWorker(...handlers)
    worker.start(options)
    api = worker
  } else {
    const { setupServer } = require('msw/node')
    const server = setupServer(...handlers)
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

export const mswDecorator = (storyFn, { parameters: { msw = [] } }) => {
  if (api) {
    api.resetHandlers()

    if (!Array.isArray(msw)) {
      throw new Error(`[MSW] expected to receive an array of handlers but received "${typeof msw}" instead.
        Please refer to the documentation: https://mswjs.io/docs/getting-started/mocks/`)
    }

    if (msw.length > 0) {
      api.use(...msw)
    }
  }

  return storyFn()
}
