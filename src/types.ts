export type MswApi = Pick<
  import('msw').SetupApi<import('msw').LifeCycleEventsMap>,
  'use' | 'restoreHandlers' | 'resetHandlers' | 'listHandlers'
>

declare module 'storybook/internal/csf' {
  interface StoryContext {
    msw: MswApi
  }
}
