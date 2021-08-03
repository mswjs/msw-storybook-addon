<p align="center">
  <img src="https://msw-sb.vercel.app/logo.png" width="200">
</p>
<h1 align="center">MSW Storybook Addon</h1>

## Features

- Mock Rest and GraphQL requests right inside your story.
- Document how a component behaves in various scenarios.
- Get a11y, snapshot and visual tests using other addons for free.

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

[Full Documentation](https://msw-sb.vercel.app/)
