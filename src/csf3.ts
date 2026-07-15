import type { LoaderFunction, Renderer } from 'storybook/internal/types'
import type { AnyHandler } from 'msw'
import { defaultSetup, type SetupFunction } from './addon'
import type { MswApi } from './shared'

export type MswParameter =
  | Array<AnyHandler>
  | {
      handlers?:
        | Array<AnyHandler>
        | Record<string, AnyHandler | Array<AnyHandler>>
    }

declare module 'storybook/internal/csf' {
  interface Parameters {
    msw?: MswParameter
  }
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

  const handlers = Array.isArray(parameter.handlers)
    ? parameter.handlers
    : Object.values(parameter.handlers)

  return handlers.flat().filter(Boolean)
}

let hasPrintedDeprecationWarning = false

function printDeprecationWarning() {
  if (!hasPrintedDeprecationWarning) {
    console.warn(
      '[msw-storybook-addon] The loader API (CSF3) is deprecated and will be removed in the next major release. Run `npx msw-storybook-migrate` to migrate. Learn more: https://github.com/mswjs/msw-storybook-addon/blob/main/MIGRATION.md#from-2xx-to-3xx'
    )
    hasPrintedDeprecationWarning = true
  }
}

let mswInstancePromise: Promise<MswApi> | undefined

/**
 * Create a loader to initialize Mock Service Worker.
 * @deprecated Use the preview annotations (`addonMsw()`) instead.
 *
 * @example
 * // .storybook/preview.ts
 * import { mswLoader } from 'msw-storybook-addon/csf3'
 *
 * export default {
 *   loaders: [mswLoader()],
 *   parameters: {
 *     msw: [...initialHandlers]
 *   }
 * }
 */
export function mswLoader(
  setup: SetupFunction = defaultSetup
): LoaderFunction<Renderer> {
  return async (context) => {
    printDeprecationWarning()

    const worker = await (mswInstancePromise ??= Promise.resolve(setup()))
    context.msw = worker

    worker.resetHandlers()

    const handlers = context.parameters.msw
      ? resolveHandlers(context.parameters.msw)
      : []

    if (handlers.length !== 0) {
      worker.use(...handlers)
    }

    return {}
  }
}
