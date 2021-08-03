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

You can also use an object with named handlers or named arrays of handlers, to inherit (and optionally overwrite/disable) handlers from preview.js.

```js

//preview.js
export const parameters = {
    msw: {
        auth: [
            rest.get('/login', (req, res, ctx) => {
                return res(
                    ctx.json({
                        success: true,
                    })
                )
            }),
            rest.get('/logout', (req, res, ctx) => {
                return res(
                    ctx.json({
                        success: true,
                    })
                )
            }),
        ],
    }
};


// story will include the auth handlers from preview.js
SuccessBehavior.parameters = {
  msw: {
      profile: rest.get('/profile', (req, res, ctx) => {
          return res(
              ctx.json({
                  firstName: 'Neil',
                  lastName: 'Maverick',
              })
          )
      }),
  }
}

// story will overwrite the auth handlers from preview.js
FailureBehavior.parameters = {
    msw: {
        auth: rest.get('/login', (req, res, ctx) => {
            return res(ctx.status(403))
        }),
    }
}

// story will disable the auth handlers from preview.js
NoAuthBehavior.parameters = {
    msw: {
        auth: null,
        others: [
            rest.get('/numbers', (req, res, ctx) => {
                return res(ctx.json([1, 2, 3]))
            }),
            rest.get('/strings', (req, res, ctx) => {
                return res(ctx.json(['a', 'b', 'c']))
            }),
        ],
    }
}
```

[Full Documentation](https://msw-sb.vercel.app/)
