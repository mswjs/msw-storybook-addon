import type { ProjectAnnotations, Renderer } from 'storybook/internal/types'

import {
  factoriesActive,
  globalMswInstance,
  setMswInstance,
  userSetup,
  type MswApi,
} from './shared-state'
import { legacyParametersDecorator } from './legacy'

export type SetupFunction = () => MswApi | Promise<MswApi>

// Lazy default, used when no setup is registered. The dynamic import keeps
// `msw/browser` out of the bundle when the addon is installed but unused.
const defaultSetup: SetupFunction = async () => {
  const { setupWorker } = await import('msw/browser')
  const worker = setupWorker()
  await worker.start({ quiet: true })
  return worker as unknown as MswApi
}

// --- annotations --------------------------------------------------------

export function createPreviewAnnotations(
  setup?: SetupFunction,
): ProjectAnnotations<Renderer> {
  return {
    async beforeEach(context) {
      if (globalMswInstance.current == null) {
        // Precedence: explicit `setup` arg > `initialize()`'s `userSetup`
        // > `defaultSetup`. Resolved here (not at construction) so an
        // `initialize()` call in preview.ts is seen even if the addon's
        // annotations were built first.
        const effective: SetupFunction =
          setup ??
          (userSetup.current ? () => userSetup.current!() : defaultSetup)
        setMswInstance(await effective())
      }

      ;(context as { msw?: MswApi }).msw = globalMswInstance.current!

      return () => {
        globalMswInstance.current?.resetHandlers()
      }
    },
    // Deprecated `parameters.msw` support — see `./legacy`. Remove the
    // import and this entry after the `msw-storybook-migrate` cycle.
    decorators: [legacyParametersDecorator],
  }
}

// Lets `initialize()` warn when factories is also configured.
export function markFactoriesActive(): void {
  factoriesActive.current = true
}
