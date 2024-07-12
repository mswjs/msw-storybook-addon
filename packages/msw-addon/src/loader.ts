import { waitForMswReady } from '@build-time/initialize'
import type { Context } from './decorator.js'
import { applyRequestHandlers } from './applyRequestHandlers.js'

export const mswLoader = async (context: Context) => {
  await waitForMswReady()
  applyRequestHandlers(context.parameters.msw)

  return {}
}
