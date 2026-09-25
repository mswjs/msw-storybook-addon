/// <reference types="msw/vite/client" preserve="true" />
import type { SetupWorker } from 'msw/browser'

export type MswApi = SetupWorker | typeof import('virtual:msw').network

// Every public entrypoint imports `MswApi` from this module, so the
// augmentation below ships with each of them: importing the addon from
// anywhere in a TypeScript program (e.g. `.storybook/preview.ts`) is enough
// to type `context.msw`. It is also exposed on its own as
// `msw-storybook-addon/types` for programs that never import the addon.
declare module 'storybook/internal/csf' {
  interface StoryContext {
    msw: MswApi
  }
}
