import React from 'react';
import { MemoryRouter as Router, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { rest } from 'msw';
import Films from './Films';

const config = {
  title: 'Demos/React Router + RQ/Page Stories/Films',
  component: Films,
};

export default config;

const defaultQueryClient = new QueryClient();

export const DefaultBehavior = (args) => (
  <QueryClientProvider client={defaultQueryClient}>
    <Router initialEntries={['/films']}>
      <Route exact path="/films">
        <Films {...args} />
      </Route>
    </Router>
  </QueryClientProvider>
);

const apiSuccessHandler = rest.get('https://swapi.dev/api/films/', (req, res, ctx) => {
  return res(
    ctx.json({
      results: [
        {
          title: '(Mocked) A New Hope',
          episode_id: 4,
          release_date: '1977-05-25',
          url: 'http://swapi.dev/api/films/1/',
        },
        {
          title: '(Mocked) Empire Strikes Back',
          episode_id: 5,
          release_date: '1980-05-17',
          url: 'http://swapi.dev/api/films/2/',
        },
      ],
    }),
  );
});

const mockedQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const MockTemplate = (args) => (
  <QueryClientProvider client={mockedQueryClient}>
    <Router initialEntries={['/films']}>
      <Route exact path="/films">
        <Films {...args} />
      </Route>
    </Router>
  </QueryClientProvider>
);

export const MockedSuccess = MockTemplate.bind({});
MockedSuccess.story = {
  parameters: {
    msw: [apiSuccessHandler],
  },
};

export const FilmsWithDivider = MockTemplate.bind({});
FilmsWithDivider.story = {
  parameters: {
    msw: [apiSuccessHandler],
  },
};
FilmsWithDivider.args = {
  isDividerShown: true,
};

export const MockedError = MockTemplate.bind({});
MockedError.story = {
  parameters: {
    msw: [
      rest.get('https://swapi.dev/api/films/', (req, res, ctx) => {
        return res(
          ctx.delay(800),
          ctx.status(403),
        );
      }),
    ],
  },
};
