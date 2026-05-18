// CSF3 customization entry point: `initialize(options, handlers)` from
// preview.ts pre-arms the worker before the addon's `beforeEach` builds
// it. `setupWorker` is imported statically (not lazily like `defaultSetup`)
// to keep the v1/v2 synchronous-return contract — `const { use } =
// initialize(...)` must not break.

import type { RequestHandler } from 'msw'
import { setupWorker, type SetupWorker } from 'msw/browser'

import { factoriesActive, userSetup } from './shared-state'

export type InitializeOptions = Parameters<SetupWorker['start']>[0]

export function initialize(
  options?: InitializeOptions,
  initialHandlers: RequestHandler[] = [],
): SetupWorker {
  if (factoriesActive.current) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn(
        '[msw-storybook-addon] initialize() was called while CSF factories ' +
          '(mswAddon() in definePreview) is also active. The initialize() ' +
          'call is ignored — pass your setup as the argument to mswAddon() ' +
          'instead.',
      )
    }
    // Still return a started worker so `const instance = initialize(...)` is still supported for backwards compatibility reasons
    const w = setupWorker(...initialHandlers)
    w.start(options).catch(() => {})
    return w
  }

  const worker = setupWorker(...initialHandlers)

  // Start now, but keep the promise so the addon's `beforeEach` can await
  // it — otherwise the first story's fetches race SW registration.
  const ready = worker.start(options).catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error('[msw-storybook-addon] worker.start() failed:', err)
  })

  // Setup thunk for `addon.ts`: stories don't see the worker until
  // `start()` resolves, even though it's returned synchronously here.
  userSetup.current = async () => {
    await ready
    return worker as unknown as import('./shared-state').MswApi
  }

  return worker
}
