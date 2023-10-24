import React from 'react';
import { MemoryRouter as Router, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';
import { rest } from 'msw';
import Character from './Character';

export default {
  title: 'Demos/React Router + RQ/Page Stories/Character',
  component: Character,
  parameters: {
    msw: {
      handlers: {
        common: [
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
              })
            );
          }),
          rest.get('https://swapi.dev/api/films/1', (req, res, ctx) => {
            return res(
              ctx.json({
                title: '(Mocked) A New Hope',
                episode_id: 4,
              })
            );
          }),
          rest.get('https://swapi.dev/api/films/2', (req, res, ctx) => {
            return res(
              ctx.json({
                title: '(Mocked) Empire Strikes Back',
                episode_id: 5,
              })
            );
          }),
        ],
      },
    },
  },
};

const defaultQueryClient = new QueryClient();

export const DefaultBehavior = {
  render: () => (
    <QueryClientProvider client={defaultQueryClient}>
      <Router initialEntries={['/characters/1']}>
        <Route exact path="/characters/:characterId">
          <Character />
        </Route>
      </Router>
    </QueryClientProvider>
  ),

  parameters: {
    msw: {
      handlers: {
        common: null,
      },
    },
  },
};

const mockedQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const MockTemplate = () => (
  <QueryClientProvider client={mockedQueryClient}>
    <Router initialEntries={['/characters/1']}>
      <Route exact path="/characters/:characterId">
        <Character />
      </Route>
    </Router>
  </QueryClientProvider>
);

export const MockedSuccess = {
  render: MockTemplate,

  parameters: {
    msw: {
      handlers: {
        planets: [
          rest.get('https://swapi.dev/api/planets/1', (req, res, ctx) => {
            return res(
              ctx.json({
                name: '(Mocked) Tatooine',
              })
            );
          }),
        ],
      },
    },
  },
};

export const MockedPlanetsApiError = {
  render: MockTemplate,

  parameters: {
    msw: {
      handlers: {
        planets: [
          rest.get('https://swapi.dev/api/planets/1', (req, res, ctx) => {
            return res(ctx.status(403));
          }),
        ],
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(/Error/i)).toBeInTheDocument()
  }
};
