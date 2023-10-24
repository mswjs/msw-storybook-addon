<p align="center">
  <img src="https://user-images.githubusercontent.com/1671563/144888802-84346d8f-77c9-4377-98c7-4b0364797978.png" width="200">
</p>
<h1 align="center">MSW Storybook Addon</h1>

## Features

- Mock Rest and GraphQL requests right inside your story.
- Document how a component behaves in various scenarios.
- Get a11y, snapshot and visual tests using other addons for free.

[Full documentation and live demos](https://msw-sb.vercel.app/)

## Installing and Setup

### Install MSW and the addon

With npm:

```sh
npm i msw msw-storybook-addon -D
```

Or with yarn:

```sh
yarn add msw msw-storybook-addon -D
```

### Generate service worker for MSW in your public folder.

_If you already use MSW in your project, you have likely done this before so you can skip this step._

```sh
npx msw init public/
```

Refer to the [MSW official guide](https://mswjs.io/docs/getting-started/integrate/browser) for framework specific paths if you don't use `public`.

### Configure the addon

Enable MSW in Storybook by initializing MSW and providing the MSW decorator in `./storybook/preview.js`:

```js
import { initialize, mswLoader } from 'msw-storybook-addon';

// Initialize MSW
initialize();

const preview = {
  parameters: { 
    // your other code...
  },
  // Provide the MSW addon loader globally
  loaders: [mswLoader],
}

export default preview
```

### Start Storybook

When running Storybook, you have to serve the `public` folder as an asset to Storybook, so that MSW is included, otherwise it will not be available in the browser.

This means you should set the `staticDirs` field in the Storybook main config file. Refer to [the docs](https://storybook.js.org/docs/react/configure/images-and-assets#serving-static-files-via-storybook-configuration) if needed.

```sh
npm run start-storybook
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

### Advanced Usage

#### Composing request handlers

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

`msw-storybook-addon` starts MSW with default configuration. `initialize` takes two arguments:
- `options`: this gets passed down to [`worker.start()`](https://mswjs.io/docs/api/setup-worker/start) when in the browser or [`server.listen()`](https://mswjs.io/docs/api/setup-server/listen) when in Node, so the same types are expected.
- `initialHandlers`: a `RequestHandler[]` type, this array is spread to either [`setupWorker()`](https://mswjs.io/docs/api/setup-worker) when in the browser or [`setupServer()`](https://mswjs.io/docs/api/setup-server) when in Node.

A common example is to configure the [onUnhandledRequest](https://mswjs.io/docs/api/setup-worker/start#onunhandledrequest) behavior, as MSW logs a warning in case there are requests which were not handled.

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

Although [composing handlers](https://github.com/mswjs/msw-storybook-addon#composing-request-handlers) is possible, that relies on Storybook's merging logic, which currently only works when the handlers in your story's parameters are objects and not arrays. To get around this limitation, you can pass initial request handlers directly the `initialize` function as a second argument.

```js
// preview.js
import { initialize } from 'msw-storybook-addon';

initialize({}, [
  rest.get('/numbers', (req, res, ctx) => {
    return res(ctx.json([1, 2, 3]))
  }),
  rest.get('/strings', (req, res, ctx) => {
    return res(ctx.json(['a', 'b', 'c']))
  }),
])
```

### Troubleshooting

#### MSW is interfering with HMR (Hot Module Replacement)

If you're experiencing issues like `[MSW] Failed to mock a "GET" request to "http://localhost:6006/4cb31fa2eee22cf5b32f.hot-update.json"` in the console, it's likely that MSW is interfering with HMR. This is not common and it seems to only happen in Webpack projects, but if it happens to you, you can follow the steps in this issue to fix it:

https://github.com/mswjs/msw-storybook-addon/issues/36#issuecomment-1496150729