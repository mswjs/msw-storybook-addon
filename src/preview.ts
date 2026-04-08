import type { ProjectAnnotations, Renderer } from 'storybook/internal/types'

import type { SetupApi, LifeCycleEventsMap } from 'msw'

declare module 'storybook/internal/csf' {
  interface StoryContext {
    msw: MswApi
  }
}

export type MswApi = Pick<
  SetupApi<LifeCycleEventsMap>,
  'use' | 'restoreHandlers' | 'resetHandlers' | 'listHandlers'
>

async function defaultSetup(): Promise<MswApi> {
  const { setupWorker } = await import('msw/browser')
  const worker = setupWorker()
  await worker.start({ quiet: true })
  return worker
}

export function createPreviewAnnotations(
  setup: () => MswApi | Promise<MswApi> = defaultSetup,
): ProjectAnnotations<Renderer> {
  let mswInstance: MswApi | undefined

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
