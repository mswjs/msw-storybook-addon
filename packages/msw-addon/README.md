<p align="center">
  <img src="https://msw-sb.vercel.app/logo.png" width="200">
</p>
<h1 align="center">MSW Storybook Addon</h1>

## Features

- Mock Rest and GraphQL requests right inside your story.
- Document how a component behaves in various scenarios.
- Get a11y, snapshot and visual tests using other addons for free.

[Full Documentation](https://msw-sb.vercel.app/)

## Quick Start

#### Install msw & storybook addon.

```sh
npm i -D msw msw-storybook-addon
```

#### Enable msw on storybook by adding these lines in `./storybook/preview.js`

```js
import { addDecorator } from '@storybook/react'
import { initializeWorker, mswDecorator } from 'msw-storybook-addon'

initializeWorker()
addDecorator(mswDecorator)
```

#### Generate service worker for msw in your public folder.

```sh
npx msw init public/
```

Refer [MSW official guide](https://mswjs.io/docs/getting-started/integrate/browser) for framework specific paths.

#### Start storybook with that public folder.

```sh
npx start-storybook -s public -p 6006
```

#### Mock API calls in a story.

```js
import { rest } from 'msw'

export const SuccessBehavior = () => <UserProfile />

SuccessBehavior.parameters = {
  msw: [
    rest.get('/user', (req, res, ctx) => {
      return res(
        ctx.json({
          firstName: 'Neil',
          lastName: 'Maverick',
        })
      )
    }),
  ],
}
```

The msw parameter takes an array of handlers as shown in [MSW official guide](https://mswjs.io/docs/getting-started/mocks/rest-api).
