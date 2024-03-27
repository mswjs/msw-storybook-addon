import React from 'react'
import { MemoryRouter as Router, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from 'react-query'
import { http, HttpResponse, delay } from 'msw'

import Films from './Films'

const meta = {
  title: 'Demos/React Router + RQ/Page Stories/Films',
  component: Films,
}

export default meta

const defaultQueryClient = new QueryClient()

export const DefaultBehavior = () => (
  <QueryClientProvider client={defaultQueryClient}>
    <Router initialEntries={['/films']}>
      <Route exact path="/films">
        <Films />
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
    <Router initialEntries={['/films']}>
      <Route exact path="/films">
        <Films />
      </Route>
    </Router>
  </QueryClientProvider>
)

export const MockedSuccess = {
  render: MockTemplate,

  parameters: {
    msw: {
      handlers: [
        http.get('https://swapi.dev/api/films/', () => {
          return HttpResponse.json({
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
        http.get('https://swapi.dev/api/films/', async () => {
          await delay(300)
          return new HttpResponse(null, {
            status: 403,
          })
        }),
      ],
    },
  },
}
