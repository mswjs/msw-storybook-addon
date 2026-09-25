# MSW Storybook Addon

Mock API requests in Storybook with Mock Service Worker.

## Usage

### Install

```sh
npm i msw-storybook-addon -D
```

> Make sure you have `msw@3.x` installed as a peer dependency.

### Register the Vite plugin

Add the `msw/vite` plugin to your Storybook's Vite config. The plugin serves the worker script itself, so there is no `msw init` step and no static directory to configure:

```ts
// .storybook/main.ts
import { msw } from 'msw/vite'

export default {
  framework: '@storybook/react-vite',
  addons: ['msw-storybook-addon'],
  viteFinal(config) {
    config.plugins ??= []
    config.plugins.push(msw())
    return config
  }
}
```

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

The addon types `context.msw` (and, for CSF 3.0, `parameters.msw`) through module augmentation. That augmentation ships with every entrypoint of the addon, so it is applied to any TypeScript program that imports the addon.

**CSF Next**: nothing to do. Your stories import `preview`, and `preview` imports the addon, so the types reach every story automatically.

**CSF 3.0**, or any setup where the stories are compiled without `.storybook/preview.ts` (e.g. a `tsconfig.json` whose `include` doesn't cover the `.storybook` directory): reference the types explicitly in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": ["msw-storybook-addon/types"]
  }
}
```

> In CSF 3.0, reference `msw-storybook-addon/csf3` instead — it types `parameters.msw` as well.

#### Custom network setup

By default, the addon enables the network of the `msw/vite` plugin for you: it ignores common asset and Storybook-internal requests and warns about the other unhandled requests. To customize that behavior (e.g. `onUnhandledFrame` or initial handlers), provide a setup function that configures the network, enables it, and returns it.

In CSF 3.0, pass it to `mswLoader`:

```ts
// .storybook/preview.ts
import { mswLoader } from 'msw-storybook-addon/csf3'

export default {
  loaders: [
    mswLoader(async () => {
      const { network } = await import('virtual:msw')
      network.configure({ onUnhandledFrame: 'bypass' })
      await network.enable()
      return network
    })
  ]
}
```

In CSF Next, pass it to `addonMsw`:

```ts
// .storybook/preview.ts
import addonMsw from 'msw-storybook-addon'

export default definePreview({
  addons: [
    addonMsw(async () => {
      const { network } = await import('virtual:msw')
      network.configure({ onUnhandledFrame: 'bypass' })
      await network.enable()
      return network
    })
  ],
})
```

> Handlers passed to `network.configure()` act as initial handlers and survive the automatic handler reset between stories.

### Provide handlers

If you have correctly installed and configured this addon, it will extend your story context with the `msw` property. Use that reference to control API mocking in your stories, e.g. by adding request handler overrides via `msw.use()`.

#### Global handlers

Provide request handlers in `preview.ts` to define the network behaviors that affect all your stories.

```ts
// .storybook/preview.ts
import { http, HttpResponse } from 'msw/http'

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
