import { definePreviewAddon } from 'storybook/internal/csf'

import {
  createPreviewAnnotations,
  markFactoriesActive,
  type SetupFunction,
} from './addon'
// Pulls in the `StoryContext.msw` type augmentation from `types.ts`.
import type {} from './types'

export type { MswApi } from './shared-state'

/**
 * CSF factories entry point — use inside `definePreview({ addons: [...] })`.
 *
 * Pass an optional setup function to customise the worker (start options,
 * initial handlers); it must return a started `SetupWorker`. If you're using CSF3,
 * register the addon in `.storybook/main.ts` and use
 * `initialize()` from `msw-storybook-addon/csf3` instead.
 *
 *     export default definePreview({ addons: [mswAddon()] })
 */
export default function addonMsw(setup?: SetupFunction) {
  markFactoriesActive()
  return definePreviewAddon(createPreviewAnnotations(setup))
}
