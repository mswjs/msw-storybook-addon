import { it, expectTypeOf } from 'vitest'
import type { MswParameter } from 'msw-storybook-addon/csf3'
import type { Parameters } from 'storybook/internal/csf'
import type { Preview, StoryObj } from '@storybook/react-vite'

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
