import { it, expectTypeOf } from 'vitest'
import type { MswApi } from 'msw-storybook-addon'
import type { StoryContext } from 'storybook/internal/csf'
import { definePreview, type StoryObj } from '@storybook/react-vite'

it('extends the story context type', () => {
  expectTypeOf<StoryContext>().toExtend<{ msw: MswApi }>()
})

it('exposes "msw" in the preview "beforeEach" hook', () => {
  definePreview({
    addons: [],
    beforeEach({ msw }) {
      expectTypeOf(msw).toEqualTypeOf<MswApi>()
    }
  })
})

it('exposes "msw" in the story "beforeEach" hook', () => {
  const story: StoryObj = {
    beforeEach({ msw }) {
      expectTypeOf(msw).toEqualTypeOf<MswApi>()
    }
  }
})

it('exposes "msw" in the "play" story function', () => {
  const story: StoryObj = {
    play({ msw }) {
      expectTypeOf(msw).toEqualTypeOf<MswApi>()
    }
  }
})
