import React from 'react';
import { render, waitFor, screen } from '@testing-library/react';
import { composeStories } from '@storybook/testing-react';
import { getWorker } from 'msw-storybook-addon';

import * as globalConfig from '../../../.storybook/preview'
import * as stories from './App.stories';

// https://github.com/storybookjs/testing-react#composestories
// By reusing the configuration from the stories, the msw decorator will be configured automatically
const { MockedSuccess, MockedError } = composeStories(stories, globalConfig);

describe('Reusing stories', () => {
  afterAll(() => {
    // setup and cleanup of handlers is already done in the decorator, we just need to close the server
    getWorker().close()
  });

  it('renders film cards for each film', async () => {
    render(<MockedSuccess />);
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
    render(<MockedError />);

    const errorMsgNode = await screen.findByText(/could not fetch star wars data/i);
    expect(errorMsgNode).toBeInTheDocument();
  });
});