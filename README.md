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

```sh
npx storybook@latest add msw-storybook-addon
```

### Generate service worker for MSW in your public folder.

_If you already use MSW in your project, you have likely done this before so you can skip this step._

```sh
npx msw init public/
```

Refer to the [MSW official guide](https://mswjs.io/docs/integrations/browser) for framework specific paths if you don't use `public`.

### Configure the addon

Enable MSW in Storybook by initializing MSW and providing the MSW loader in `./storybook/preview.js`:

```ts
import { initialize, mswLoader } from 'msw-storybook-addon'

// Initialize MSW
initialize()

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

This means you should set the `staticDirs` field in the Storybook main config file. Refer to [the docs](https://storybook.js.org/docs/configure/images-and-assets#serving-static-files-via-storybook-configuration) if needed.

```sh
npm run storybook
```

## Usage

You can pass request handlers (https://mswjs.io/docs/concepts/request-handler) into the `handlers` property of the `msw` parameter. This is commonly an array of handlers.

```ts
import { http, HttpResponse } from 'msw'

export const SuccessBehavior = {
  parameters: {
    msw: {
      handlers: [
        http.get('/user', () => {
          return HttpResponse.json({
            firstName: 'Neil',
            lastName: 'Maverick',
          })
        }),
      ],
    },
  },
}
```

### Advanced Usage

#### Composing request handlers

The `handlers` property can also be an object where the keys are either arrays of handlers or a handler itself. This enables you to inherit (and optionally overwrite/disable) handlers from preview.js using [parameter inheritance](https://storybook.js.org/docs/writing-stories/parameters#rules-of-parameter-inheritance):

```ts
type MswParameter = {
  handlers: RequestHandler[] | Record<string, RequestHandler | RequestHandler[]>
}
```

Suppose you have an application where almost every component needs to mock requests to `/login` and `/logout` the same way.
You can set global MSW handlers in preview.js for those requests and bundle them into a property called `auth`, for example:

```ts
//preview.ts
import { http, HttpResponse } from 'msw'

// These handlers will be applied in every story
export const parameters = {
  msw: {
    handlers: {
      auth: [
        http.get('/login', () => {
          return HttpResponse.json({
            success: true,
          })
        }),
        http.get('/logout', () => {
          return HttpResponse.json({
            success: true,
          })
        }),
      ],
    },
  },
}
```

Then, you can use other handlers in your individual story. Storybook will merge both global handlers and story handlers:

```ts
import { http, HttpResponse } from 'msw'

// This story will include the auth handlers from .storybook/preview.ts and profile handlers
export const SuccessBehavior = {
  parameters: {
    msw: {
      handlers: {
        profile: http.get('/profile', () => {
          return HttpResponse.json({
            firstName: 'Neil',
            lastName: 'Maverick',
          })
        }),
      },
    },
  },
}
```

Now suppose you want to ovewrite the global handlers for auth. All you have to do is set them again in your story and these values will take precedence:

```ts
import { http, HttpResponse } from 'msw'

// This story will overwrite the auth handlers from preview.ts
export const FailureBehavior = {
  parameters: {
    msw: {
      handlers: {
        auth: http.get('/login', () => {
          return HttpResponse.json(null, { status: 403 })
        }),
      },
    },
  },
}
```

What if you want to disable global handlers? All you have to do is set them as null and they will be ignored for your story:

```ts
import { http, HttpResponse } from 'msw'

// This story will disable the auth handlers from preview.ts
export const NoAuthBehavior = {
  parameters: {
    msw: {
      handlers: {
        auth: null,
        others: [
          http.get('/numbers', () => {
            return HttpResponse.json([1, 2, 3])
          }),
          http.get('/strings', () => {
            return HttpResponse.json(['a', 'b', 'c'])
          }),
        ],
      },
    },
  },
}
```

#### Configuring MSW

`msw-storybook-addon` starts MSW with default configuration. `initialize` takes two arguments:

- `options`: this gets passed down to [`worker.start()`](https://mswjs.io/docs/api/setup-worker/start) when in the browser or [`server.listen()`](https://mswjs.io/docs/api/setup-server/listen) when in Node, so the same types are expected.
- `initialHandlers`: a `RequestHandler[]` type, this array is spread to either [`setupWorker()`](https://mswjs.io/docs/api/setup-worker) when in the browser or [`setupServer()`](https://mswjs.io/docs/api/setup-server) when in Node.

A common example is to configure the [onUnhandledRequest](https://mswjs.io/docs/api/setup-worker/start#onunhandledrequest) behavior, as MSW logs a warning in case there are requests which were not handled.

If you want MSW to bypass unhandled requests and not do anything:

```ts
// .storybook/preview.ts
import { initialize } from 'msw-storybook-addon'

initialize({
  onUnhandledRequest: 'bypass',
})
```

If you want to warn a helpful message in case stories make requests that should be handled but are not:

```ts
// .storybook/preview.ts
import { initialize } from 'msw-storybook-addon'

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

Although [composing handlers](#composing-request-handlers) is possible, that relies on Storybook's merging logic, which **only works when the handlers in your story's parameters are objects and not arrays**. To get around this limitation, you can pass initial request handlers directly the `initialize` function as a second argument.

```ts
// .storybook/preview.ts
import { http, HttpResponse } from 'msw'
import { initialize } from 'msw-storybook-addon'

initialize({}, [
  http.get('/numbers', () => {
    return HttpResponse.json([1, 2, 3])
  }),
  http.get('/strings', () => {
    return HttpResponse.json(['a', 'b', 'c'])
  }),
])
```

#### Using the addon in Node.js with Portable Stories

If you're using [portable stories](https://storybook.js.org/docs/writing-tests/stories-in-unit-tests), you need to make sure you call the `load` function of your story, so that the MSW loaders are applied correctly.

```ts
import { composeStories } from '@storybook/react'
import * as stories from './MyComponent.stories'

const { Success } = composeStories(stories)

test('<Success />', async() => {
  // crucial step, so that the msw loaders are applied
  await Success.load()
  render(<Success />)
})
```

### Troubleshooting

#### MSW is interfering with HMR (Hot Module Replacement)

If you're experiencing issues like `[MSW] Failed to mock a "GET" request to "http://localhost:6006/4cb31fa2eee22cf5b32f.hot-update.json"` in the console, it's likely that MSW is interfering with HMR. This is not common and it seems to only happen in Webpack projects, but if it happens to you, you can follow the steps in this issue to fix it:

https://github.com/mswjs/msw-storybook-addon/issues/36#issuecomment-1496150729
