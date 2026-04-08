import type { ProjectAnnotations, Renderer } from 'storybook/internal/types'

import type { RequestHandler, SetupApi, LifeCycleEventsMap } from 'msw'

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

// Backwards compatibility code, should be removed in a future release.
function resolveHandlers(
  mswParam:
    | RequestHandler[]
    | {
        handlers?:
          | RequestHandler[]
          | Record<string, RequestHandler | RequestHandler[]>
      },
): RequestHandler[] {
  if (Array.isArray(mswParam)) {
    return mswParam
  }

  if (mswParam.handlers == null) {
    return []
  }

  if (Array.isArray(mswParam.handlers)) {
    return mswParam.handlers
  }

  return Object.values(mswParam.handlers)
    .filter(Boolean)
    .flat() as RequestHandler[]
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
    // Backwards compatibility code
    // Currently sitting in decorators because they run after all beforeEach hooks, so parameters.msw handlers
    // correctly take priority over global handlers set via beforeEach. This is to keep
    // TODO: This is not great, ideally the parameters should be processed in the beforeEach hook.
    // It's only here so that if people want to use old API and new API it will work as expected.
    // However resolving things in the decorator is quite late so we should use beforeEach instead!
    decorators: [
      (storyFn, context) => {
        const mswParam = context.parameters?.msw
        if (mswParam != null && mswInstance != null) {
          const handlers = resolveHandlers(mswParam)
          if (handlers.length > 0) {
            mswInstance.use(...handlers)
          }
        }
        return storyFn()
      },
    ],
  }
}
