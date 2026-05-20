import type { DecoratorFunction, Renderer } from 'storybook/internal/types'
import { type AnyHandler } from 'msw'
import { setupWorker, type StartOptions } from 'msw/browser'

export type InitializeOptions = StartOptions

type MswParameter =
  | Array<AnyHandler>
  | {
      handlers?:
        | Array<AnyHandler>
        | Record<string, AnyHandler | Array<AnyHandler>>
    }

/**
 * Resolve the legacy `parameters.msw` handler definitions to a flat list of handlers.
 */
function resolveHandlers(parameter: MswParameter): Array<AnyHandler> {
  if (Array.isArray(parameter)) {
    return parameter
  }

  if (parameter.handlers == null) {
    return []
  }

  if (Array.isArray(parameter.handlers)) {
    return parameter.handlers
  }

  return Object.values(parameter.handlers).filter(Boolean).flat()
}

/**
 * @deprecated Use the preview annotations (`addonMsw()`) instead.
 */
export function withMsw(
  options?: InitializeOptions,
  initialHandlers: Array<AnyHandler> = [],
): DecoratorFunction<Renderer> {
  const worker = setupWorker(...initialHandlers)
  worker.start(options).catch((error) => console.error(error))

  return (storyFn, context) => {
    worker.resetHandlers()

    const mswParameter = Reflect.get(context.parameters, 'msw') as
      | MswParameter
      | undefined

    if (!mswParameter) {
      return storyFn()
    }

    const handlers = resolveHandlers(mswParameter)

    if (handlers.length === 0) {
      return
    }

    console.warn(
      '[msw-storybook-addon] `parameters.msw` is deprecated and will be remove in the future major release. Run `npx msw-storybook-migrate` to migrate.',
    )

    console.log('applying overrides...')
    worker.use(...handlers)

    return storyFn()
  }
}
