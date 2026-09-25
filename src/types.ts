/// <reference types="msw/vite/client" preserve="true" />

/**
 * The network instance exposed on `context.msw`. It is the network of the
 * `msw/vite` plugin (`virtual:msw`), so the plugin must be registered in the
 * Vite config of the Storybook project.
 */
export type MswApi = typeof import('virtual:msw').network

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
