import { it, expectTypeOf } from 'vitest'
import type { MswParameter } from 'msw-storybook-addon/csf3'
import type { MswApi } from 'msw-storybook-addon'
import type { Parameters, StoryContext } from 'storybook/internal/csf'
import type { Preview, StoryObj } from '@storybook/react-vite'

// This fixture has no `types` entry in its `tsconfig.json`: importing the
// addon is what augments the context, as it does in a CSF 3.0 preview.
it('extends the story context type', () => {
  expectTypeOf<StoryContext>().toExtend<{ msw: MswApi }>()
})

it('exposes the "msw" context in the story "beforeEach" hook', () => {
  // The CSF 3.0 loader assigns `context.msw` too, not just the annotations.
  const story: StoryObj = {
    beforeEach({ msw }) {
      expectTypeOf(msw).not.toBeAny()
      expectTypeOf(msw).toEqualTypeOf<MswApi>()
    }
  }
  expectTypeOf(story).toExtend<StoryObj>()
})

it('augments the "parameters" type', () => {
  expectTypeOf<Parameters>().toExtend<{
    msw?: MswParameter
  }>()
})

it('exposes "msw" in preview parameters', () => {
  expectTypeOf<Preview['parameters']>().exclude<undefined>().toExtend<{
    msw?: MswParameter
  }>()
})

it('exposes "msw" in story parameters', () => {
  expectTypeOf<StoryObj['parameters']>().exclude<undefined>().toExtend<{
    msw?: MswParameter
  }>()
})

it('does not require the "msw" parameter', () => {
  // Stories and previews that set unrelated parameters must not be forced
  // to declare `msw`.
  const story: StoryObj = {
    parameters: {
      layout: 'centered'
    }
  }
  const preview: Preview = {
    parameters: {}
  }
  expectTypeOf(story).toExtend<StoryObj>()
  expectTypeOf(preview).toExtend<Preview>()
})

it('exposes "msw" in the story "beforeEach" hook', () => {
  const story: StoryObj = {
    parameters: {
      msw: []
    },
    beforeEach({ parameters }) {
      expectTypeOf(parameters).toExtend<{
        msw?: MswParameter
      }>()
    }
  }
})
