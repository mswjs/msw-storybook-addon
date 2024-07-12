import type { RequestHandler } from 'msw'
import { api } from '@build-time/initialize'
import type { Context } from './decorator.js'
import { deprecate } from './util.js'

const deprecateMessage = deprecate(`
[msw-storybook-addon] You are using parameters.msw as an Array instead of an Object with a property "handlers". This usage is deprecated and will be removed in the next release. Please use the Object syntax instead.

More info: https://github.com/mswjs/msw-storybook-addon/blob/main/MIGRATION.md#parametersmsw-array-notation-deprecated-in-favor-of-object-notation
`)

// P.S. this is publicly exported as it is used by Storybook 7 users as a way to help them migrate.
// This should be removed from the package exports in a future release.
export function applyRequestHandlers(
  handlersListOrObject: Context['parameters']['msw']
): void {
  api?.resetHandlers()

  if (handlersListOrObject == null) {
    return
  }

  if (Array.isArray(handlersListOrObject) && handlersListOrObject.length > 0) {
    deprecateMessage()
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
