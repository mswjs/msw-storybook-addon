// Cross-module singleton state. Kept dependency-free (the SetupWorker
// import is type-only) so it can live in the auto-loaded preview chunk
// without pulling in `msw/browser`.

import type { SetupWorker } from 'msw/browser'

export type MswApi = SetupWorker

// --- worker singleton ----------------------------------------------------

export const globalMswInstance: { current: MswApi | null } = { current: null }

// Reserved extension point for a future Storybook manager panel.
//
// The worker is created lazily in `addon.ts`'s `beforeEach`. A panel would
// need a handle to it (to attach `worker.events.on(...)` listeners and
// proxy MSW activity over the addon channel) but can't know whether it
// registers before or after that creation. `onMswInstance` hides that
// timing: subscribers are notified exactly once, immediately if the worker
// already exists, otherwise when `setMswInstance` is called.
//
// There is no subscriber at the moment, but this will be an important piece when
// we build an addon panel that shows MSW activity from stories.
const instanceSubscribers = new Set<(worker: MswApi) => void>()

export function setMswInstance(worker: MswApi): void {
  globalMswInstance.current = worker
  for (const cb of instanceSubscribers) {
    try {
      cb(worker)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[msw-storybook-addon] instance subscriber threw:', err)
    }
  }
}

export function onMswInstance(cb: (worker: MswApi) => void): () => void {
  // Fire immediately if the worker already exists, else wait for
  // `setMswInstance`.
  if (globalMswInstance.current) cb(globalMswInstance.current)
  instanceSubscribers.add(cb)
  return () => {
    instanceSubscribers.delete(cb)
  }
}

// --- setup overrides -----------------------------------------------------

export const userSetup: {
  current: (() => MswApi | Promise<MswApi>) | null
} = { current: null }

export const factoriesActive: { current: boolean } = { current: false }
