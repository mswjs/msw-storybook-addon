import type { MswApi } from './shared-state'

declare module 'storybook/internal/csf' {
  interface StoryContext {
    msw: MswApi
  }
}

export type { MswApi }
