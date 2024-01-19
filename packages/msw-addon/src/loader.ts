import type { Context } from './decorator'
import { applyRequestHandlers } from './applyRequestHandlers'

export const mswLoader = async (context: Context) => {
  applyRequestHandlers(context.parameters.msw)

  if (
    typeof window !== 'undefined' &&
    'navigator' in window &&
    navigator.serviceWorker.controller
  ) {
    // No need to rely on the MSW Promise exactly
    // since only 1 worker can control 1 scope at a time.
    await navigator.serviceWorker.ready
  }

  return {}
}
