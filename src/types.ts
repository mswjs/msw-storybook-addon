declare module 'storybook/internal/csf' {
  interface StoryContext {
    msw: import('./shared').MswApi
  }
}

export {}
