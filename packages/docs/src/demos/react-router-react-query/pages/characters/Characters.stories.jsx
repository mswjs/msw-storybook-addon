import React from 'react'
import { MemoryRouter as Router, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from 'react-query'
import { http, HttpResponse, delay } from 'msw'

import Characters from './Characters'

const meta = {
  title: 'Demos/React Router + RQ/Page Stories/Characters',
  component: Characters,
}

export default meta

const defaultQueryClient = new QueryClient()

export const DefaultBehavior = () => (
  <QueryClientProvider client={defaultQueryClient}>
    <Router initialEntries={['/characters']}>
      <Route exact path="/characters">
        <Characters />
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
    <Router initialEntries={['/characters']}>
      <Route exact path="/characters">
        <Characters />
      </Route>
    </Router>
  </QueryClientProvider>
)

export const MockedSuccess = {
  render: MockTemplate,

  parameters: {
    msw: {
      handlers: [
        http.get('https://swapi.dev/api/people/', () => {
          return HttpResponse.json({
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
        http.get('https://swapi.dev/api/people/', async () => {
          await delay(300)
          return new HttpResponse(null, {
            status: 403,
          })
        }),
      ],
    },
  },
}
