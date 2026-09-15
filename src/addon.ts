import { isCommonAssetRequest } from 'msw'
import type { ProjectAnnotations, Renderer } from 'storybook/internal/types'
import type { MswApi } from './shared'
// Every public entrypoint pulls in this module, so importing the addon from
// anywhere in a TypeScript program (e.g. `.storybook/preview.ts`) is enough to
// type `context.msw`. The same augmentation is also exposed explicitly as
// `msw-storybook-addon/types` for programs that never import the addon.
import './types'

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
