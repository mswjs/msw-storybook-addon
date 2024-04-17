import React from 'react'
import { MemoryRouter as Router } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from 'react-query'
import { http, HttpResponse } from 'msw'

import { App } from './App'

const meta = {
  title: 'Demos/React Router + RQ',
  component: App,
}

export default meta;

const defaultQueryClient = new QueryClient()

export const DefaultApp = () => (
  <QueryClientProvider client={defaultQueryClient}>
    <Router>
      <App />
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

export const MockedApp = {
  render: () => (
    <QueryClientProvider client={mockedQueryClient}>
      <Router>
        <App />
      </Router>
    </QueryClientProvider>
  ),

  parameters: {
    msw: {
      handlers: {
        films: [
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
          http.get('https://swapi.dev/api/films/1', () => {
            return HttpResponse.json({
              title: '(Mocked) A New Hope',
              episode_id: 4,
              opening_crawl: `Rebel spaceships have won their first victory against the evil Galactic Empire.`,
              characters: ['http://swapi.dev/api/people/1/', 'http://swapi.dev/api/people/2/'],
            })
          }),
          http.get('https://swapi.dev/api/films/2', () => {
            return HttpResponse.json({
              title: '(Mocked) Empire Strikes Back',
              episode_id: 5,
              opening_crawl: `Imperial troops are pursuing the Rebel forces across the galaxy.`,
              characters: ['http://swapi.dev/api/people/1/'],
            })
          }),
        ],
        people: [
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
          http.get('https://swapi.dev/api/people/1', () => {
            return HttpResponse.json({
              name: '(Mocked) Luke Skywalker',
              birth_year: '19BBY',
              eye_color: 'blue',
              hair_color: 'blond',
              height: '172',
              mass: '77',
              homeworld: 'http://swapi.dev/api/planets/1/',
              films: ['http://swapi.dev/api/films/1/', 'http://swapi.dev/api/films/2/'],
            })
          }),
          http.get('https://swapi.dev/api/people/2', () => {
            return HttpResponse.json({
              name: '(Mocked) C-3PO',
              birth_year: '112BBY',
              eye_color: 'yellow',
              hair_color: 'n/a',
              height: '167',
              mass: '75',
              homeworld: 'http://swapi.dev/api/planets/1/',
              films: ['http://swapi.dev/api/films/1/'],
            })
          }),
        ],
        planets: http.get('https://swapi.dev/api/planets/1', () => {
          return HttpResponse.json({
            name: '(Mocked) Tatooine',
          })
        }),
      },
    },
  },
}

export const MockedFilmSubsection = {
  render: () => (
    <QueryClientProvider client={mockedQueryClient}>
      <Router initialEntries={['/films/1']}>
        <App />
      </Router>
    </QueryClientProvider>
  ),

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
            birth_year: '19BBY',
            eye_color: 'blue',
            hair_color: 'blond',
            height: '172',
            mass: '77',
            homeworld: 'http://swapi.dev/api/planets/1/',
            films: ['http://swapi.dev/api/films/1/', 'http://swapi.dev/api/films/2/'],
          })
        }),
        http.get('https://swapi.dev/api/people/2', () => {
          return HttpResponse.json({
            name: '(Mocked) C-3PO',
            birth_year: '112BBY',
            eye_color: 'yellow',
            hair_color: 'n/a',
            height: '167',
            mass: '75',
            homeworld: 'http://swapi.dev/api/planets/1/',
            films: ['http://swapi.dev/api/films/1/'],
          })
        }),
      ],
    },
  },
}
