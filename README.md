<p align="center">
  <img src="https://msw-sb.vercel.app/logo.png" width="200">
</p>
<h1 align="center">MSW Storybook Addon</h1>

## Features

- Mock Rest and GraphQL requests right inside your story.
- Document how a component behaves in various scenarios.
- Get a11y, snapshot and visual tests using other addons for free.

[Full documentation and live demos](https://msw-sb.vercel.app/)

## Installing and Setup

### Install MSW and the addon

```sh
npm i -D msw msw-storybook-addon
```

### Generate service worker for MSW in your public folder.

_If you already use MSW in your project, you have likely done this before so you can skip this step._

```sh
npx msw init public/
```

Refer to the [MSW official guide](https://mswjs.io/docs/getting-started/integrate/browser) for framework specific paths if you don't use `public`.

### Enable MSW in Storybook by adding this to `./storybook/preview.js`

```js
import { initialize, mswDecorator } from 'msw-storybook-addon';

// Initialize MSW
initialize();

// Provide the MSW addon decorator globally
export const decorators = [mswDecorator];
```

### Start Storybook

When running Storybook, you have to serve the `public` folder as an asset to Storybook. Refer to [the docs](https://storybook.js.org/docs/react/configure/images-and-assets) if needed.

```sh
npm run start-storybook -s public
```

## Usage

You can pass request handlers (https://mswjs.io/docs/basics/request-handler) into the `handlers` property of the `msw` parameter. This is commonly an array of handlers.

```js
import { rest } from 'msw'

export const SuccessBehavior = () => <UserProfile />

SuccessBehavior.parameters = {
  msw: {
    handlers: [
      rest.get('/user', (req, res, ctx) => {
        return res(
          ctx.json({
            firstName: 'Neil',
            lastName: 'Maverick',
          })
        )
      }),
    ]
  },
}
```

**Deprecated usage**

From previous versions, the msw parameter takes an array of handlers. **This is not recommended** anymore and is deprecated. You should use the `handlers` instead, as stated above.

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

### Advanced Usage

#### Sharing handlers with parameter inheritance

The `handlers` property can also be an object where the keys are either arrays of handlers or a handler itself. This enables you to inherit (and optionally overwrite/disable) handlers from preview.js using [parameter inheritance](https://storybook.js.org/docs/react/writing-stories/parameters#rules-of-parameter-inheritance):

```ts
type MswParameter = {
  handlers: RequestHandler[] | Record<string, RequestHandler | RequestHandler[]>
}
``` 

Suppose you have an application where almost every component needs to mock requests to `/login` and `/logout` the same way. 
You can set global MSW handlers in preview.js for those requests and bundle them into a property called `auth`, for example:

```js
//preview.js

// These handlers will be applied in every story
export const parameters = {
   msw: {
      handlers: {
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
   }
};
```

Then, you can use other handlers in your individual story. Storybook will merge both global handlers and story handlers:

```js
// This story will include the auth handlers from preview.js and profile handlers
SuccessBehavior.parameters = {
  msw: {
   handlers: {
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
}
```

Now suppose you want to ovewrite the global handlers for auth. All you have to do is set them again in your story and these values will take precedence:
```js
// This story will overwrite the auth handlers from preview.js
FailureBehavior.parameters = {
  msw: {
   handlers: {
    auth: rest.get('/login', (req, res, ctx) => {
      return res(ctx.status(403))
    }),
   }
  }
}

```

What if you want to disable global handlers? All you have to do is set them as null and they will be ignored for your story:
```js
// This story will disable the auth handlers from preview.js
NoAuthBehavior.parameters = {
  msw: {
   handlers: {
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
}
```

#### Configuring MSW

`msw-storybook-addon` starts MSW with default configuration. If you want to configure it, you can pass options to the `initialize` function. They are the [StartOptions](https://mswjs.io/docs/api/setup-worker/start) from setupWorker.

A common example is to configure the `onUnhandledRequest` behavior, as MSW logs a warning in case there are requests which were not handled.

If you want MSW to bypass unhandled requests and not do anything:
```js
// preview.js
import { initialize } from 'msw-storybook-addon';

initialize({
  onUnhandledRequest: 'bypass'
})
```

If you want to warn a helpful message in case stories make requests that should be handled but are not:
```js
// preview.js
import { initialize } from 'msw-storybook-addon';

initialize({
  onUnhandledRequest: ({ method, url }) => {
    if (url.pathname.startsWith('/my-specific-api-path')) {
      console.error(`Unhandled ${method} request to ${url}.

        This exception has been only logged in the console, however, it's strongly recommended to resolve this error as you don't want unmocked data in Storybook stories.

        If you wish to mock an error response, please refer to this guide: https://mswjs.io/docs/recipes/mocking-error-responses
      `)
    }
  },
})
```

#### Using this addon in node

Storybook provides libraries like [@storybook/testing-react](https://github.com/storybookjs/testing-react) that allow you to reuse your stories in test suites directly.
If you are using stories in your tests, `msw-storybook-addon` will work as intended, but instead of using a service worker implementation, it will use a server implementation. `msw-storybook-addon` provides access to the server instance, in case you'd like to do something with it:

```js
// src/setupTests.js
import { getWorker } from 'msw-storybook-addon';

// Clean up after the tests are finished.
afterAll(() => getWorker().close())
```
