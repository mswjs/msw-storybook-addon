import { isCommonAssetRequest } from 'msw'
import type { ProjectAnnotations, Renderer } from 'storybook/internal/types'
import type { MswApi } from './shared'

export type SetupFunction = () => MswApi | Promise<MswApi>

function isCommonStorybookRequest(request: Request) {
  return /\.eot$|\.mdx$|sb-common-assets|__webpack_hmr|iframe.html|sb-vite|@vite|@react-refresh|\/virtual:|\.stories\./.test(
    request.url,
  )
}

export const defaultSetup: SetupFunction = async () => {
  const { setupWorker } = await import('msw/browser')
  const worker = setupWorker()

  await worker.start({
    quiet: true,
    onUnhandledRequest(request, print) {
      if (isCommonAssetRequest(request) || isCommonStorybookRequest(request)) {
        return
      }

      print.warning()
    },
  })

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
