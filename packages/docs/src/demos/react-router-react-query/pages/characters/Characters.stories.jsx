import React from 'react';
import { MemoryRouter as Router, Route } from 'react-router-dom';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';
import { QueryClient, QueryClientProvider } from 'react-query';
import { rest } from 'msw';
import Characters from './Characters';

export default {
  title: 'Demos/React Router + RQ/Page Stories/Characters',
  component: Characters,
};

const defaultQueryClient = new QueryClient();

export const DefaultBehavior = () => (
  <QueryClientProvider client={defaultQueryClient}>
    <Router initialEntries={['/characters']}>
      <Route exact path="/characters">
        <Characters />
      </Route>
    </Router>
  </QueryClientProvider>
);

const mockedQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const MockTemplate = () => (
  <QueryClientProvider client={mockedQueryClient}>
    <Router initialEntries={['/characters']}>
      <Route exact path="/characters">
        <Characters />
      </Route>
    </Router>
  </QueryClientProvider>
);

export const MockedSuccess = {
  render: MockTemplate,

  parameters: {
    msw: {
      handlers: [
        rest.get('https://swapi.dev/api/people/', (req, res, ctx) => {
          return res(
            ctx.json({
              results: [
                {
                  name: '(Mocked) Luke Skywalker',
                  url: 'http://swapi.dev/api/people/1/',
                },
                {
                  name: '(Mocked) C-3PO',
                  url: 'http://swapi.dev/api/people/2/',
                },
              ],
            })
          );
        }),
      ],
    },
  },
};

export const MockedError = {
  render: MockTemplate,

  parameters: {
    msw: {
      handlers: [
        rest.get('https://swapi.dev/api/people/', (req, res, ctx) => {
          return res(ctx.status(403));
        }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(/Error/i)).toBeInTheDocument()
  }
};
