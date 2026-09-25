/// <reference types="msw/vite/client" preserve="true" />
import { HttpNetworkFrame } from 'msw/experimental'
import { isCommonAssetRequest } from 'msw/utils/is-common-asset-request'
import type { ProjectAnnotations, Renderer } from 'storybook/internal/types'
import type { MswApi } from './types'

export type SetupFunction = () => MswApi | Promise<MswApi>

function isCommonStorybookRequest(request: Request) {
  return /\.eot$|\.mdx$|sb-common-assets|__webpack_hmr|iframe.html|sb-vite|@vite|@react-refresh|\/virtual:|\.stories\./.test(
    request.url
  )
}

/**
 * Enable the network provided by the `msw/vite` plugin (`virtual:msw`).
 * The plugin serves the worker script itself, so there is nothing to
 * generate with `msw init` and no static directory to configure.
 */
export const defaultSetup: SetupFunction = async () => {
  const { network } = await import('virtual:msw')

  network.configure({
    onUnhandledFrame({ frame, defaults }) {
      if (frame instanceof HttpNetworkFrame) {
        const { request } = frame.data

        if (
          isCommonAssetRequest(request) ||
          isCommonStorybookRequest(request)
        ) {
          return
        }
      }

      defaults.warn()
    }
  })

  await network.enable()

  return network
}

let mswInstance: MswApi | undefined

export function createPreviewAnnotations(
  setup: SetupFunction = defaultSetup
): ProjectAnnotations<Renderer> {
  return {
    async beforeEach(context) {
      // Loaders run before `beforeEach`. If `mswLoader()` has already put a
      // worker on the context (CSF 3.0 projects also get these annotations
      // when the addon is listed in `main.ts`), reuse it instead of starting
      // another one.
      if (context.msw != null) {
        return
      }

      if (mswInstance == null) {
        mswInstance = await setup()
      }

      context.msw = mswInstance

      return () => {
        context.msw?.resetHandlers()
      }
    }
  }
}
