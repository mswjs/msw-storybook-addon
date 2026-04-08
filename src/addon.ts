import type { MswApi } from './types'
import type { ProjectAnnotations, Renderer } from 'storybook/internal/types'
export type SetupFunction = () => MswApi | Promise<MswApi>

const defaultSetup: SetupFunction = async () => {
  const { setupWorker } = await import('msw/browser')
  const worker = setupWorker()
  await worker.start({ quiet: true })
  return worker
}

let mswInstance: MswApi | undefined

export function createPreviewAnnotations(
  setup: SetupFunction = defaultSetup,
): ProjectAnnotations<Renderer> {
  return {
    async beforeEach(context) {
      if (mswInstance == null) {
        mswInstance = await setup()
      }

      context.msw = mswInstance

      return () => {
        context.msw?.resetHandlers()
      }
    },
  }
}
