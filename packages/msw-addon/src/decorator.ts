import type { RequestHandler } from 'msw'
import { applyRequestHandlers } from './applyRequestHandlers.js'
import { deprecate } from './util.js'

export type MswParameters = {
  [key: string]: any;
  msw?:
    | RequestHandler[]
    | {
        handlers: RequestHandler[] | Record<string, RequestHandler | RequestHandler[]>
      }
}

export type Context = {
  parameters: MswParameters
}

const deprecateMessage = deprecate(`
[msw-storybook-addon] The mswDecorator is deprecated and will be removed in the next release. Please use the mswLoader instead.

More info: https://github.com/mswjs/msw-storybook-addon/blob/main/MIGRATION.md#mswdecorator-is-deprecated-in-favor-of-mswloader
`)

/**
 * @deprecated The `mswDecorator` is deprecated and will be removed in the next release. Please use the `mswLoader` instead.
 * More info: https://github.com/mswjs/msw-storybook-addon/blob/ec35e9371f8a56a27220838fba798b9001ac7fad/MIGRATION.md#mswdecorator-is-deprecated-in-favor-of-mswloader
 */
export const mswDecorator = <Story extends (...args: any[]) => any>(
  storyFn: Story,
  context: Context
) => {
  deprecateMessage()
  applyRequestHandlers(context.parameters.msw)
  return storyFn()
}
