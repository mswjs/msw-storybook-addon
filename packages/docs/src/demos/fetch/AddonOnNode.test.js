import React from 'react';
import { render, waitFor, screen } from '@testing-library/react';

import { initializeWorker, mswDecorator } from 'msw-storybook-addon';
import { MockedSuccess, MockedError } from './App.stories';

// Useful in scenarios where the addon runs on node, such as with @storybook/testing-react
describe('Running msw-addon on node', () => {
  let server

  beforeAll(() => {
    server = initializeWorker()
  })

  afterAll(() => {
    server.stop()
  })

  it('renders film cards for each film', async () => {
    // Story + msw addon decorator, which resets and applies the server handlers based on story parameters
    render(mswDecorator(MockedSuccess, { parameters: MockedSuccess.parameters }));

    expect(screen.getByText(/fetching star wars data/i)).toBeInTheDocument();

    await waitFor(() => screen.getAllByRole('article'));

    const articleNodes = screen.getAllByRole('article');
    expect(articleNodes.length).toEqual(3);

    const headingNodes = screen.getAllByRole('heading');
    expect(headingNodes[0]).toHaveTextContent('A New Hope');
    expect(headingNodes[1]).toHaveTextContent('Empire Strikes Back');
    expect(headingNodes[2]).toHaveTextContent('Return of the Jedi');
  });

  it('renders error message if it cannot load the films', async () => {
    // Story + msw addon decorator, which resets and applies the server handlers based on story parameters
    render(mswDecorator(MockedError, { parameters: MockedError.parameters }));

    const errorMsgNode = await screen.findByText(/could not fetch star wars data/i);
    expect(errorMsgNode).toBeInTheDocument();
  });

})
