import React from 'react';
import { MemoryRouter as Router, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { rest } from 'msw';
import Character from './Character';

export default {
  title: 'Demos/React Router + RQ/Page Stories/Character',
  component: Character,
};

const defaultQueryClient = new QueryClient();

export const DefaultBehavior = () => (
  <QueryClientProvider client={defaultQueryClient}>
    <Router initialEntries={['/characters/1']}>
      <Route exact path="/characters/:characterId">
        <Character />
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

const commonMockHandlers = [
  rest.get('https://swapi.dev/api/people/1', (req, res, ctx) => {
    return res(
      ctx.json({
        name: '(Mocked) Luke Skywalker',
        birth_year: '19BBY',
        eye_color: 'blue',
        hair_color: 'blond',
        height: '172',
        mass: '77',
        homeworld: 'http://swapi.dev/api/planets/1/',
        films: ['http://swapi.dev/api/films/1/', 'http://swapi.dev/api/films/2/'],
      }),
    );
  }),
  rest.get('https://swapi.dev/api/films/1', (req, res, ctx) => {
    return res(
      ctx.json({
        title: '(Mocked) A New Hope',
        episode_id: 4,
      }),
    );
  }),
  rest.get('https://swapi.dev/api/films/2', (req, res, ctx) => {
    return res(
      ctx.json({
        title: '(Mocked) Empire Strikes Back',
        episode_id: 5,
      }),
    );
  }),
];

const MockTemplate = () => (
  <QueryClientProvider client={mockedQueryClient}>
    <Router initialEntries={['/characters/1']}>
      <Route exact path="/characters/:characterId">
        <Character />
      </Route>
    </Router>
  </QueryClientProvider>
);

export const MockedSuccess = MockTemplate.bind({});
MockedSuccess.parameters = {
  msw: [
    ...commonMockHandlers,
    rest.get('https://swapi.dev/api/planets/1', (req, res, ctx) => {
      return res(
        ctx.json({
          name: '(Mocked) Tatooine',
        }),
      );
    }),
  ],
};

export const MockedPlanetsApiError = MockTemplate.bind({});
MockedPlanetsApiError.parameters = {
  msw: [
    ...commonMockHandlers,
    rest.get('https://swapi.dev/api/planets/1', (req, res, ctx) => {
      return res(ctx.delay(800), ctx.status(403));
    }),
  ],
};
