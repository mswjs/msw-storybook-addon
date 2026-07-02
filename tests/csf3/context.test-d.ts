import { it, expectTypeOf } from 'vitest'
import type { MswParameter } from 'msw-storybook-addon/csf3'
import type { Parameters } from 'storybook/internal/csf'
import type { Preview, StoryObj } from '@storybook/react-vite'

it('augments the "parameters" type', () => {
  expectTypeOf<Parameters>().toExtend<{
    msw: MswParameter | undefined
  }>()
})

it('exposes "msw" in preview parameters', () => {
  expectTypeOf<Preview['parameters']>().exclude<undefined>().toExtend<{
    msw: MswParameter | undefined
  }>()
})

it('exposes "msw" in story parameters', () => {
  expectTypeOf<StoryObj['parameters']>().exclude<undefined>().toExtend<{
    msw: MswParameter | undefined
  }>()
})

it('exposes "msw" in the story "beforeEach" hook', () => {
  const story: StoryObj = {
    parameters: {
      msw: []
    },
    beforeEach({ parameters }) {
      expectTypeOf(parameters).toExtend<{
        msw: MswParameter | undefined
      }>()
    }
  }
})
