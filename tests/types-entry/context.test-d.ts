import { it, expectTypeOf } from 'vitest'
type Network = typeof import('virtual:msw').network
import type { StoryObj } from '@storybook/react-vite'

// A project that never imports the addon: no preview here, and the `include`
// covers this directory only. `"types": ["msw-storybook-addon/types"]` in the
// tsconfig is the only thing that can augment the story context.
it('types the story context through "msw-storybook-addon/types"', () => {
  const story: StoryObj = {
    beforeEach({ msw }) {
      expectTypeOf(msw).toEqualTypeOf<Network>()
    }
  }
  expectTypeOf(story).toExtend<StoryObj>()
})
