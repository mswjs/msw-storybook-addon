import { it, expectTypeOf } from 'vitest'
import type { MswApi } from 'msw-storybook-addon'
import type { StoryContext } from 'storybook/internal/csf'
import type { StoryObj } from '@storybook/react-vite'
import preview from './.storybook/preview'

// This fixture has no `types` entry in its `tsconfig.json`. The preview
// imports `msw-storybook-addon`, and CSF Next stories import the preview, so
// the augmentation reaches every story without any tsconfig changes.
it('extends the story context type by importing the addon', () => {
  expectTypeOf<StoryContext>().toExtend<{ msw: MswApi }>()
})

it('exposes "msw" in the CSF Next story hooks', () => {
  const meta = preview.meta({ component: () => null })

  meta.story({
    beforeEach({ msw }) {
      expectTypeOf(msw).toEqualTypeOf<MswApi>()
    },
    play({ msw }) {
      expectTypeOf(msw).toEqualTypeOf<MswApi>()
    }
  })
})

it('exposes "msw" in the CSF 3.0 story hooks of the same program', () => {
  const story: StoryObj = {
    beforeEach({ msw }) {
      expectTypeOf(msw).toEqualTypeOf<MswApi>()
    }
  }
  expectTypeOf(story).toExtend<StoryObj>()
})
