import type { SetupApi, LifeCycleEventsMap } from 'msw'
import { definePreviewAddon } from 'storybook/internal/csf'

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

let mswInstance: MswApi | undefined

export function enableMocking(
  setup: () => MswApi | Promise<MswApi> = defaultSetup,
) {
  return definePreviewAddon({
    async beforeEach(context) {
      if (mswInstance == null) {
        mswInstance = await setup()
      }

      context.msw = mswInstance

      return () => {
        context.msw?.resetHandlers()
      }
    },
  })
}
