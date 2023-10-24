import React from 'react'
import { MemoryRouter as Router, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from 'react-query'
import { http, HttpResponse, delay } from 'msw'

import Film from './Film'

const meta = {
  title: 'Demos/React Router + RQ/Page Stories/Film',
  component: Film,
}

export default meta

const defaultQueryClient = new QueryClient()

export const DefaultBehavior = () => (
  <QueryClientProvider client={defaultQueryClient}>
    <Router initialEntries={['/films/1']}>
      <Route exact path="/films/:filmId">
        <Film />
      </Route>
    </Router>
  </QueryClientProvider>
)

const mockedQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
})

const MockTemplate = () => (
  <QueryClientProvider client={mockedQueryClient}>
    <Router initialEntries={['/films/1']}>
      <Route exact path="/films/:filmId">
        <Film />
      </Route>
    </Router>
  </QueryClientProvider>
)

export const MockedSuccess = {
  render: MockTemplate,

  parameters: {
    msw: {
      handlers: [
        http.get('https://swapi.dev/api/films/1', () => {
          return HttpResponse.json({
            title: '(Mocked) A New Hope',
            episode_id: 4,
            opening_crawl: `Rebel spaceships have won their first victory against the evil Galactic Empire.`,
            characters: ['http://swapi.dev/api/people/1/', 'http://swapi.dev/api/people/2/'],
          })
        }),
        http.get('https://swapi.dev/api/people/1', () => {
          return HttpResponse.json({
            name: '(Mocked) Luke Skywalker',
          })
        }),
        http.get('https://swapi.dev/api/people/2', () => {
          return HttpResponse.json({
            name: '(Mocked) C-3PO',
          })
        }),
      ],
    },
  },
}

export const MockedFilmApiError = {
  render: MockTemplate,

  parameters: {
    msw: {
      handlers: [
        http.get('https://swapi.dev/api/films/1', async () => {
          await delay(300)
          return new HttpResponse(null, {
            status: 403,
          })
        }),
      ],
    },
  },
}

export const MockedCharacterApiError = {
  render: MockTemplate,

  parameters: {
    msw: {
      handlers: [
        http.get('https://swapi.dev/api/people/1', async () => {
          return new HttpResponse(null, {
            status: 403,
          })
        }),
        http.get('https://swapi.dev/api/people/2', () => {
          return HttpResponse.json({
            name: '(Mocked) C-3PO',
          })
        }),
        http.get('https://swapi.dev/api/films/1', () => {
          return HttpResponse.json({
            title: '(Mocked) A New Hope',
            episode_id: 4,
            opening_crawl: `Rebel spaceships have won their first victory against the evil Galactic Empire.`,
            characters: ['http://swapi.dev/api/people/1/', 'http://swapi.dev/api/people/2/'],
          })
        }),
      ],
    },
  },
}
