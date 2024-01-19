import type { RequestHandler, SetupApi } from 'msw'
import type { Context } from './decorator'
import { api } from '@build-time/initialize'

export const mswLoader = async (context: Context) => {
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
          .reduce<RequestHandler[]>(
            (handlers, handlersList) => handlers.concat(handlersList),
            []
          )

        if (handlers.length > 0) {
          api.use(...handlers)
        }
      }
    }
  }

  if (
    typeof window !== 'undefined' &&
    'navigator' in window &&
    navigator.serviceWorker.controller
  ) {
    // No need to rely on the MSW Promise exactly
    // since only 1 worker can control 1 scope at a time.
    await navigator.serviceWorker.ready
  }

  return {}
}
