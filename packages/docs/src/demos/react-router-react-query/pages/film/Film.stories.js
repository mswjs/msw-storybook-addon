import React from 'react';
import { MemoryRouter as Router, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { rest } from 'msw';
import Film from './Film';

export default {
  title: 'Demos/React Router + RQ/Page Stories/Film',
  component: Film,
};

const defaultQueryClient = new QueryClient();

export const DefaultBehavior = () => (
  <QueryClientProvider client={defaultQueryClient}>
    <Router initialEntries={['/films/1']}>
      <Route exact path="/films/:filmId">
        <Film />
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
    <Router initialEntries={['/films/1']}>
      <Route exact path="/films/:filmId">
        <Film />
      </Route>
    </Router>
  </QueryClientProvider>
);

export const MockedSuccess = MockTemplate.bind({});
MockedSuccess.parameters = {
  msw: {
    handlers: [
      rest.get('https://swapi.dev/api/films/1', (req, res, ctx) => {
        return res(
          ctx.json({
            title: '(Mocked) A New Hope',
            episode_id: 4,
            opening_crawl: `Rebel spaceships have won their first victory against the evil Galactic Empire.`,
            characters: ['http://swapi.dev/api/people/1/', 'http://swapi.dev/api/people/2/'],
          }),
        );
      }),
      rest.get('https://swapi.dev/api/people/1', (req, res, ctx) => {
        return res(
          ctx.json({
            name: '(Mocked) Luke Skywalker',
          }),
        );
      }),
      rest.get('https://swapi.dev/api/people/2', (req, res, ctx) => {
        return res(
          ctx.json({
            name: '(Mocked) C-3PO',
          }),
        );
      }),
    ]
  },
};

export const MockedFilmApiError = MockTemplate.bind({});
MockedFilmApiError.parameters = {
  msw: {
    handlers: [
      rest.get('https://swapi.dev/api/films/1', (req, res, ctx) => {
        return res(
          ctx.delay(800),
          ctx.status(403),
        );
      }),
    ]
  },
};

export const MockedCharacterApiError = MockTemplate.bind({});
MockedCharacterApiError.parameters = {
  msw: {
    handlers: [
      rest.get('https://swapi.dev/api/films/1', (req, res, ctx) => {
        return res(
          ctx.json({
            title: '(Mocked) A New Hope',
            episode_id: 4,
            opening_crawl: `Rebel spaceships have won their first victory against the evil Galactic Empire.`,
            characters: ['http://swapi.dev/api/people/1/', 'http://swapi.dev/api/people/2/'],
          }),
        );
      }),
      rest.get('https://swapi.dev/api/people/1', (req, res, ctx) => {
        return res(
          ctx.delay(800),
          ctx.status(403),
        );
      }),
      rest.get('https://swapi.dev/api/people/2', (req, res, ctx) => {
        return res(
          ctx.json({
            name: '(Mocked) C-3PO',
          }),
        );
      }),
    ]
  },
};
