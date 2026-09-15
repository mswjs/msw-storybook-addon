import { it, expectTypeOf } from 'vitest'
import type { SetupWorker } from 'msw/browser'
import type { Parameters, StoryContext } from 'storybook/internal/csf'
import type { StoryObj } from '@storybook/react-vite'
import type { MswParameter } from 'msw-storybook-addon/csf3'

// This fixture has no `types` entry in its `tsconfig.json`: the `.storybook`
// directory is in `include`, and the preview imports `msw-storybook-addon/csf3`.
// That import alone augments both the story context and the parameters.
it('extends the story context type by importing the "csf3" entry', () => {
  expectTypeOf<StoryContext>().toExtend<{ msw: SetupWorker }>()
})

it('augments the "parameters" type by importing the "csf3" entry', () => {
  expectTypeOf<Parameters>().toExtend<{ msw?: MswParameter }>()
})

it('exposes "msw" in the story "beforeEach" hook', () => {
  const story: StoryObj = {
    parameters: {
      msw: []
    },
    beforeEach({ msw, parameters }) {
      expectTypeOf(msw).not.toBeAny()
      expectTypeOf(msw).toEqualTypeOf<SetupWorker>()
      expectTypeOf(parameters).toExtend<{ msw?: MswParameter }>()
    }
  }
  expectTypeOf(story).toExtend<StoryObj>()
})
