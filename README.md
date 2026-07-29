# MSW Storybook Addon

Mock API requests in Storybook with Mock Service Worker.

## Usage

### Install

```sh
npm i msw-storybook-addon -D
```

> Make sure you have `msw@2.x` installed as a peer dependency.

### Generate the worker script

Next, use the MSW CLI to generate a worker script at the given path:

```sh
npx msw init ./public --save
```

> Replace `./public` with the path to your static directory of Storybook.

### Configure Storybook

#### CSF 3.0

> The loader API for CSF 3.0 is _deprecated_. Please consider using the [CSF Next](#csf-next) API instead.

```ts
// .storybook/main.ts
export default {
  addons: ['msw-storybook-addon'],
}
```

```ts
// .storybook/preview.ts
import { mswLoader } from 'msw-storybook-addon/csf3'

export default {
  loaders: [mswLoader()],
  parameters: {
    msw: [...initialHandlers]
  }
}
```

#### CSF Next

If you are using the [CSF Next](https://storybook.js.org/docs/api/csf/csf-next) syntax (also known as CSF Factories), it's enough to import and call the addon function in `preview.ts`:

```ts
// .storybook/preview.ts
import addonMsw from 'msw-storybook-addon'

export default definePreview({
  addons: [addonMsw()],
})
```

> `parameters.msw` is not supported in CSF Next. It is preserved only for CSF 3.0 to make migration easier — use the `beforeEach` hook instead.

#### Types

`parameters.msw` and `context.msw` are typed as soon as the addon is imported anywhere in your TypeScript project, such as `.storybook/preview.ts`. Make sure that file is covered by the `include` of the `tsconfig.json` your stories use:

```json
{
  "include": [".storybook/*", "..."]
}
```

If your preview lives outside that project, reference the types directly instead:

```json
{
  "compilerOptions": {
    "types": ["msw-storybook-addon/types"]
  }
}
```

> In CSF 3.0, reference `msw-storybook-addon/csf3` instead — it types `parameters.msw` as well.

#### Custom worker setup

By default, the addon creates and starts the worker for you: it starts quietly and ignores common asset and Storybook-internal requests. To customize that behavior (e.g. `worker.start()` options or initial handlers), provide a setup function that creates the worker, starts it, and returns it.

In CSF 3.0, pass it to `mswLoader`:

```ts
// .storybook/preview.ts
import { setupWorker } from 'msw/browser'
import { mswLoader } from 'msw-storybook-addon/csf3'

export default {
  loaders: [
    mswLoader(async () => {
      const worker = setupWorker()
      await worker.start({ onUnhandledRequest: 'bypass' })
      return worker
    })
  ]
}
```

In CSF Next, pass it to `addonMsw`:

```ts
// .storybook/preview.ts
import { setupWorker } from 'msw/browser'
import addonMsw from 'msw-storybook-addon'

export default definePreview({
  addons: [
    addonMsw(async () => {
      const worker = setupWorker()
      await worker.start({ onUnhandledRequest: 'bypass' })
      return worker
    })
  ],
})
```

> Handlers passed to `setupWorker()` act as initial handlers and survive the automatic handler reset between stories.

### Provide handlers

If you have correctly installed and configured this addon, it will extend your story context with the `msw` property. Use that reference to control API mocking in your stories, e.g. by adding request handler overrides via `msw.use()`.

#### Global handlers

Provide request handlers in `preview.ts` to define the network behaviors that affect all your stories.

```ts
// .storybook/preview.ts
import { http, HttpResponse } from 'msw'

export default {
  beforeEach({ msw }) {
    msw.use(
      http.get('https://api.acme.com/user', () => {
        return HttpResponse.json({ name: 'John Maverick' })
      }),
    )
  },
}
```

#### Story handlers

To describe network behaviors on a story basis, add them in the `beforeEach` hook of the respective story.

```ts
export const UserProfileNetworkError: Story = {
  beforeEach({ msw }) {
    msw.use(
      http.get('https://api.acme.com/user', () => {
        return HttpResponse.error()
      }),
    )
  },
}
```

## Related materials

- [Mock Service Worker](https://mswjs.io/docs)
