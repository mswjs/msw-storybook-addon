import React from 'react'
import { rest } from 'msw'
import { App } from './App'

const config = {
  title: 'Demos/Fetch',
  component: App,
}

export default config

export const DefaultBehavior = () => <App />

const MockTemplate = () => <App />

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

export const MockedSuccess = MockTemplate.bind({})
MockedSuccess.story = {
  parameters: {
    api: [
      rest.get('https://swapi.dev/api/films/', (req, res, ctx) => {
        return res(
          ctx.json({
            results: films,
          }),
        )
      }),
    ],
  },
}

export const MockedError = MockTemplate.bind({})
MockedError.story = {
  parameters: {
    api: [
      rest.get('https://swapi.dev/api/films/', (req, res, ctx) => {
        return res(ctx.delay(800), ctx.status(403))
      }),
    ],
  },
}
