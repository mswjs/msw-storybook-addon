<p align="center">
  <img src="https://msw-sb.netlify.app/logo.png" width="200">
</p>
<h1 align="center">MSW Storybook Addon</h1>

## Features

- Mock REST and GraphQL requests right inside your story.
- Document how a component behaves in various scenarios.
- Get a11y, snapshot and visual tests using other addons for free.

[Full Documentation](https://msw-sb.netlify.app/)

## Quick Start

#### Install msw & storybook addon

```sh
npm i msw msw-storybook-addon -D
```

#### Enable msw on storybook by adding these lines in `./storybook/preview.js`

```js
import { addDecorator } from '@storybook/react'
import { mswDecorator } from 'msw-storybook-addon'

addDecorator(mswDecorator())
```

#### Generate service worker for msw in your public folder

```sh
npx msw init public/
```

Refer [MSW official guide](https://mswjs.io/docs/getting-started/integrate/browser) for framework specific paths.

#### Start storybook with that public folder

```sh
npx start-storybook -s public -p 6006
```

#### Mock API calls in a story

```js
import { rest } from 'msw'

export const SuccessBehavior = () => <UserProfile />

SuccessBehavior.story = {
  parameters: {
    api: [
      rest.get('/user', (req, res, ctx) => {
        return res(
          ctx.json({
            firstName: 'Neil',
            lastName: 'Maverick',
          }),
        )
      }),
    ],
  },
}
```

The `api` parameter takes an array of request handlers as shown in [MSW official guide](https://mswjs.io/docs/getting-started/mocks/rest-api).
