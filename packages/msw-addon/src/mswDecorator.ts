import { isNodeProcess } from 'is-node-process'
import type { DecoratorFunction, StoryContext } from '@storybook/addons'
import type { SetupWorkerApi, RequestHandler } from 'msw'
import type { SetupServerApi } from 'msw/node'

export type SetupApi = SetupWorkerApi | SetupServerApi
export type InitializeOptions =
  | Parameters<SetupWorkerApi['start']>[0]
  | Parameters<SetupServerApi['listen']>[0]

export type DecoratorParameters = {
  msw?:
    | RequestHandler[]
    | { handlers: RequestHandler[] | Record<string, RequestHandler> }
}

export interface DecoratorContext extends StoryContext {
  parameters: StoryContext['parameters'] & DecoratorParameters
}

const IS_BROWSER = !isNodeProcess()
let api: SetupApi

export function initialize(options?: InitializeOptions): SetupApi {
  if (IS_BROWSER) {
    const { setupWorker } = require('msw')
    const worker = setupWorker()
    worker.start(options)
    api = worker
  } else {
    /**
     * Webpack 5 does not provide node polyfills as it did before.
     * Also, it can't tell whether a code will be executed at runtime, so it has to process everything.
     * This branch of the conditional statement will NEVER run in the browser, but Webpack can't know so
     * it breaks builds unless we start providing node polyfills.
     *
     * As a workaround, we use __non_webpack_require__ to tell Webpack to ignore this, and we define it
     * to globalThis so it works correctly when running in node.
     * @see https://github.com/webpack/webpack/issues/8826#issuecomment-660594260
     */
    const nodeVer = typeof process !== "undefined" && process.versions?.node;
    const nodeRequire = nodeVer
      ? typeof __webpack_require__ === "function"
        ? __non_webpack_require__
        : require
      : undefined;
     
    const { setupServer } = nodeRequire('msw/node')
    const server = setupServer()
    server.listen(options)
    api = server
  }

  return api
}

export function initializeWorker(options?: InitializeOptions): SetupApi {
  console.warn(
    `[MSW] "initializeWorker" is now deprecated, please use "initialize" instead. This method will be removed in future releases.`
  )
  return initialize(options)
}

export function getWorker(): SetupApi {
  if (api === undefined) {
    throw new Error(
      `[MSW] Failed to retrieve the worker: no active worker found. Did you forget to call "initialize"?`
    )
  }

  return api
}

export const mswDecorator: DecoratorFunction = (
  storyFn,
  context: DecoratorContext
) => {
  const {
    parameters: { msw },
  } = context

  if (api) {
    api.resetHandlers()

    if (msw) {
      if (Array.isArray(msw) && msw.length > 0) {
        // Support an Array of request handlers (backwards compatability).
        api.use(...msw)
      } else if ('handlers' in msw && msw.handlers) {
        // Support an Array named request handlers handlers
        // or an Object of named request handlers with named arrays of handlers
        const handlers = Object.values(msw.handlers)
          .filter(Boolean)
          .reduce(
            (handlers, handlersList) => handlers.concat(handlersList),
            [] as RequestHandler[]
          )

        if (handlers.length > 0) {
          api.use(...handlers)
        }
      }
    }
  }

  return storyFn()
}
