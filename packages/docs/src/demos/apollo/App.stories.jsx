import React from 'react'
import { ApolloClient, ApolloProvider, InMemoryCache } from '@apollo/client'
import { graphql, HttpResponse, delay } from 'msw'

import { App } from './App'

const meta = {
  title: 'Demos/Apollo',
  component: App,
}

export default meta;

const defaultClient = new ApolloClient({
  uri: 'https://swapi-graphql.netlify.app/.netlify/functions/index',
  cache: new InMemoryCache(),
})

export const DefaultBehavior = () => (
  <ApolloProvider client={defaultClient}>
    <App />
  </ApolloProvider>
)

const mockedClient = new ApolloClient({
  uri: 'https://swapi-graphql.netlify.app/.netlify/functions/index',
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'no-cache',
      errorPolicy: 'all',
    },
    query: {
      fetchPolicy: 'no-cache',
      errorPolicy: 'all',
    },
  },
})

const MockTemplate = () => (
  <ApolloProvider client={mockedClient}>
    <App />
  </ApolloProvider>
)

const films = [
  {
    title: 'A New Hope',
    episode_id: 4,
    opening_crawl: `(Mocked) Rebel spaceships have won their first victory against the evil Galactic Empire.`,
  },
  {
    title: 'Empire Strikes Back',
    episode_id: 5,
    opening_crawl: `(Mocked) Imperial troops are pursuing the Rebel forces across the galaxy.`,
  },
  {
    title: 'Return of the Jedi',
    episode_id: 6,
    opening_crawl: `(Mocked) Luke Skywalker has returned to his home planet of Tatooine to rescue Han Solo.`,
  },
]

export const MockedSuccess = {
  render: MockTemplate,

  parameters: {
    msw: {
      handlers: [
        graphql.query('AllFilmsQuery', () => {
          return HttpResponse.json({
            data: {
              allFilms: {
                films,
              },
            },
          })
        }),
      ],
    },
  },
}

export const MockedError = {
  render: MockTemplate,

  parameters: {
    msw: {
      handlers: [
        graphql.query('AllFilmsQuery', async () => {
          await delay(300)
          return HttpResponse.json({
            errors: [
              {
                message: 'Access denied',
              },
            ],
          })
        }),
      ],
    },
  },
}
