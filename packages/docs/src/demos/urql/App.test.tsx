import React from 'react'
import { render, screen } from '@testing-library/react'
import { composeStories } from '@storybook/react'
import { it, expect } from 'vitest'

import { getServer } from '../../test-utils'
import * as stories from './App.stories'

const { MockedSuccess, MockedError } = composeStories(stories)

const server = getServer()

it('renders film cards for each film', async () => {
  server.use(...MockedSuccess.parameters.msw.handlers)
  render(<MockedSuccess />)

  expect(screen.getByText(/fetching star wars data/i)).toBeInTheDocument()

  await screen.findAllByRole('article')

  const articleNodes = screen.getAllByRole('article')
  expect(articleNodes).toHaveLength(3)

  const headingNodes = screen.getAllByRole('heading')
  expect(headingNodes[0]).toHaveTextContent('A New Hope')
  expect(headingNodes[1]).toHaveTextContent('Empire Strikes Back')
  expect(headingNodes[2]).toHaveTextContent('Return of the Jedi')
})

it('renders error message if it cannot load the films', async () => {
  server.use(...MockedError.parameters.msw.handlers)
  render(<MockedError />)

  const errorMsgNode = await screen.findByText(
    /could not fetch star wars data/i
  )
  expect(errorMsgNode).toBeInTheDocument()
})
