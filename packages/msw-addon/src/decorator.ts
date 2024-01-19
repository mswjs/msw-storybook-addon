import type { RequestHandler } from 'msw'
import { api, initialize } from '@build-time/initialize'

export type MswParameters = {
  msw?:
    | RequestHandler[]
    | {
        handlers: RequestHandler[] | Record<string, RequestHandler>
      }
}

export type Context = {
  parameters: MswParameters
}

export const mswDecorator = <Story extends (...args: any[]) => any>(
  storyFn: Story,
  context: Context
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

  return storyFn()
}
