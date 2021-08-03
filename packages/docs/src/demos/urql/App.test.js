import React from 'react';
import { render, waitFor, screen } from '@testing-library/react';

import { getServer } from '../../test-utils';
import { MockedSuccess, MockedError } from './App.stories';

const server = getServer();

it('renders film cards for each film', async () => {
  server.use(...MockedSuccess.parameters.msw);
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
  server.use(...MockedError.parameters.msw);
  render(<MockedError />);

  const errorMsgNode = await screen.findByText(/could not fetch star wars data/i);
  expect(errorMsgNode).toBeInTheDocument();
});
