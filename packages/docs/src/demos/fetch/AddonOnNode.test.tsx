/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { composeStories, setProjectAnnotations } from '@storybook/react'
import { describe, afterAll, it, expect } from 'vitest'

import { getWorker, applyRequestHandlers } from 'msw-storybook-addon'
import * as stories from './App.stories'
import projectAnnotations from '../../../.storybook/preview'

setProjectAnnotations(projectAnnotations)

const { MockedSuccess, MockedError } = composeStories(stories)

// Useful in scenarios where the addon runs on node, such as with portable stories
describe('Running msw-addon on node', () => {
  afterAll(() => {
    // @ts-expect-error TS(2339): Property 'close' does not exist on type 'SetupWork... Remove this comment to see the full error message
    getWorker().close()
  })

  it('renders film cards for each film', async () => {

    await MockedSuccess.load()
    // Story + msw addon decorator, which resets and applies the server handlers based on story parameters
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
    await applyRequestHandlers(MockedError.parameters.msw)
    // Story + msw addon decorator, which resets and applies the server handlers based on story parameters
    render(<MockedError />)

    const errorMsgNode = await screen.findByText(/could not fetch star wars data/i)
    expect(errorMsgNode).toBeInTheDocument()
  })
})
