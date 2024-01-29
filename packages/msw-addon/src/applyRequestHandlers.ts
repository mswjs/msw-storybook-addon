import type { RequestHandler } from 'msw'
import { api } from '@build-time/initialize'
import type { Context } from './decorator'

export function applyRequestHandlers(
  handlersListOrObject: Context['parameters']['msw']
): void {
  api?.resetHandlers();
  
  if (handlersListOrObject == null) {
    return
  }

  if (Array.isArray(handlersListOrObject) && handlersListOrObject.length > 0) {
    // Support an Array of request handlers (backwards compatability).
    api.use(...handlersListOrObject)
    return
  }

  if ('handlers' in handlersListOrObject && handlersListOrObject.handlers) {
    // Support an Array named request handlers handlers
    // or an Object of named request handlers with named arrays of handlers
    const handlers = Object.values(handlersListOrObject.handlers)
      .filter(Boolean)
      .reduce<RequestHandler[]>(
        (handlers, handlersList) => handlers.concat(handlersList),
        []
      )

    if (handlers.length > 0) {
      api.use(...handlers)
    }

    return
  }
}
