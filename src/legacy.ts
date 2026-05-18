// Legacy `parameters.msw` shim.
//
// Keeps v1/v2 (and half-migrated) codebases working until the codemod has
// moved everything to `beforeEach({ msw })`. Everything in this file is
// deprecated and meant to be deleted after the `msw-storybook-migrate`
// deprecation cycle — kept isolated here so that removal is a one-file
// delete plus dropping the `decorators` entry in `addon.ts`.
//
// Accepted `parameters.msw` shapes:
//   - `msw: RequestHandler[]`                              (legacy array)
//   - `msw: { handlers: RequestHandler[] }`
//   - `msw: { handlers: Record<string, RequestHandler | RequestHandler[]> }`

import type { DecoratorFunction, Renderer } from 'storybook/internal/types'
import type { RequestHandler } from 'msw'

import { globalMswInstance } from './shared-state'

type MswParam =
  | RequestHandler[]
  | {
      handlers?:
        | RequestHandler[]
        | Record<string, RequestHandler | RequestHandler[]>
    }

function resolveHandlers(param: MswParam): RequestHandler[] {
  if (Array.isArray(param)) return param
  if (param.handlers == null) return []
  if (Array.isArray(param.handlers)) return param.handlers
  return Object.values(param.handlers)
    .filter(Boolean)
    .flat() as RequestHandler[]
}

// This has to be a decorator: Storybook runs loaders and `beforeEach` both
// *before* render, and a story's `parameters.msw` must override the
// preview-level `beforeEach({ msw })` default — so the shim must run after
// all `beforeEach`, which only a decorator (it runs during render) does.
//
// Unlike the old `mswDecorator`, this is NOT flaky: that flake was the
// decorator racing service-worker registration. Here the worker is built
// and awaited in `beforeEach` (which runs before any decorator), so by the
// time this runs the SW is ready — it only places handlers.
let warned = false

export const legacyParametersDecorator: DecoratorFunction<Renderer> = (
  storyFn,
  context,
) => {
  const mswParam = (context.parameters as { msw?: MswParam })?.msw
  const worker = globalMswInstance.current
  if (mswParam != null && worker != null) {
    const handlers = resolveHandlers(mswParam)
    if (handlers.length > 0) {
      // Warns in production too — intentionally annoying so the
      // deprecation can't be ignored until `parameters.msw` is removed.
      if (!warned) {
        warned = true
        // eslint-disable-next-line no-console
        console.warn(
          '[msw-storybook-addon] `parameters.msw` is deprecated and will be ' +
            'removed in a future major. It is applied at render, so it takes ' +
            'precedence over `beforeEach({ msw })` — do not define both for ' +
            'the same request. Run `npx msw-storybook-migrate` to migrate.',
        )
      }
      worker.use(...handlers)
    }
  }
  return storyFn()
}
