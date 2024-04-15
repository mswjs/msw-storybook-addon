import { dedent } from 'ts-dedent'
import type { RequestHandler } from 'msw'
import { applyRequestHandlers } from './applyRequestHandlers.js'

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

let hasBeenCalled = false
const once = (fn: () => void) => {
  if (!hasBeenCalled) {
    hasBeenCalled = true
    fn()
  }
}

export const mswDecorator = <Story extends (...args: any[]) => any>(
  storyFn: Story,
  context: Context
) => {
  once(() => {
    console.warn(dedent`
      [msw-storybook-addon] The mswDecorator is deprecated and will be removed in the next release. Please use the mswLoader instead.
      
      More info: https://github.com/mswjs/msw-storybook-addon/blob/main/MIGRATION.md#mswdecorator-is-deprecated-in-favor-of-mswloader
    `)
  })
  applyRequestHandlers(context.parameters.msw)
  return storyFn()
}
