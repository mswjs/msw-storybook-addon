<h1>Migration</h1>

- [From 2.x.x to 3.x.x](#from-2xx-to-3xx)
  - [Storybook required version is now 9 or higher](#storybook-required-version-is-now-9-or-higher)
  - [MSW required version is now 3 or higher and the worker script is served by msw/vite](#msw-required-version-is-now-3-or-higher-and-the-worker-script-is-served-by-mswvite)
  - [initialize is removed in favor of a custom setup function](#initialize-is-removed-in-favor-of-a-custom-setup-function)
  - [mswLoader moved to msw-storybook-addon/csf3 and is now a factory](#mswloader-moved-to-msw-storybook-addoncsf3-and-is-now-a-factory)
  - [mswDecorator is removed](#mswdecorator-is-removed)
  - [Node.js support is dropped](#nodejs-support-is-dropped)
  - [parameters.msw is deprecated in favor of beforeEach](#parametersmsw-is-deprecated-in-favor-of-beforeeach)
  - [New: CSF Next support](#new-csf-next-support)
- [From 1.x.x to 2.x.x](#from-1xx-to-2xx)
  - [MSW required version is now ^2.0.0](#msw-required-version-is-now-200)
  - [mswDecorator is deprecated in favor of mswLoader](#mswdecorator-is-deprecated-in-favor-of-mswloader)
  - [parameters.msw Array notation deprecated in favor of Object notation](#parametersmsw-array-notation-deprecated-in-favor-of-object-notation)

## From 2.x.x to 3.x.x

Most of this migration is automated: after upgrading the addon, run

```sh
npx msw-storybook-addon migrate
```

It rewrites your preview and main config, and migrates `parameters.msw` to `beforeEach` in your stories. Anything it cannot migrate safely is listed for you to migrate yourself using the sections below — and don't worry, `parameters.msw` keeps working until you do.

### Storybook required version is now 9 or higher

The addon now requires Storybook 9.0.0 or higher.

### MSW required version is now 3 or higher and the worker script is served by msw/vite

The addon now requires `msw@3` and relies on its Vite plugin. Register `msw/vite` in your Storybook's Vite config, then delete the `mockServiceWorker.js` you generated with `msw init` and the `staticDirs`/`msw.workerDirectory` entries that pointed at it — the plugin serves the script itself:

```diff
// .storybook/main.ts
+import { msw } from 'msw/vite'

export default {
  framework: '@storybook/react-vite',
  addons: ['msw-storybook-addon'],
-  staticDirs: ['../public'],
+  viteFinal(config) {
+    config.plugins ??= []
+    config.plugins.push(msw())
+    return config
+  }
}
```

`context.msw` is now the network instance of the plugin (`virtual:msw`) instead of a `setupWorker()` worker. `use`, `resetHandlers`, `restoreHandlers`, `listHandlers` and `events` are unchanged; `start`/`stop` are replaced by `enable`/`disable`.

### initialize is removed in favor of a custom setup function

The addon now enables the network for you, with sensible defaults: it ignores common asset and Storybook-internal requests, so custom `onUnhandledRequest` functions written to silence those warnings are likely not needed anymore.

If you passed custom options or initial handlers to `initialize`, pass a setup function to `mswLoader` instead. The setup function configures the network with your options, enables it, and returns it:

```diff
// .storybook/preview.js
-import { initialize, mswLoader } from 'msw-storybook-addon'
+import { mswLoader } from 'msw-storybook-addon/csf3'

-initialize({ onUnhandledRequest: 'bypass' })

const preview = {
-  loaders: [mswLoader]
+  loaders: [
+    mswLoader(async () => {
+      const { network } = await import('virtual:msw')
+      network.configure({ onUnhandledFrame: 'bypass' })
+      await network.enable()
+      return network
+    })
+  ]
}

export default preview
```

### mswLoader moved to msw-storybook-addon/csf3 and is now a factory

`mswLoader` is imported from `msw-storybook-addon/csf3` and needs to be called:

```diff
// .storybook/preview.js
-import { mswLoader } from 'msw-storybook-addon'
+import { mswLoader } from 'msw-storybook-addon/csf3'

const preview = {
-  loaders: [mswLoader]
+  loaders: [mswLoader()]
}

export default preview
```

The loader API is deprecated and will be removed in the next major release. It keeps working in v3, respecting the `parameters.msw` you set. When you are ready, migrate to [CSF Next](#new-csf-next-support) to stop using the loader altogether.

### mswDecorator is removed

`mswDecorator` was deprecated in 2.x.x and is now removed. Please use `mswLoader` as described [in the 2.x.x migration](#mswdecorator-is-deprecated-in-favor-of-mswloader), or migrate to [CSF Next](#new-csf-next-support).

### Node.js support is dropped

The addon now always runs MSW in the browser through the `msw/vite` plugin.

If you render stories in Node.js, keep using a custom setup function: `virtual:msw` resolves to a Node.js network in Vite's server environment, and the addon only interacts with the instance you return through methods both networks implement:

```ts
// .storybook/preview.ts
import { mswLoader } from 'msw-storybook-addon/csf3'

const preview = {
  loaders: [
    mswLoader(async () => {
      const { network } = await import('virtual:msw')
      await network.enable()
      return network
    })
  ]
}

export default preview
```

### parameters.msw is deprecated in favor of beforeEach

The addon now extends your story context with the `msw` property. Use it in `beforeEach` hooks to add request handlers, globally in `preview.ts` or on a per-story basis. Handlers are reset between stories automatically. This is much closer to the standard way of using MSW, so it's highly recommended to switch.

```ts
// ❌ Instead of defining handlers in the msw parameter:
export const MyStory = {
  parameters: {
    msw: {
      handlers: [...] // some handlers here
    }
  }
}

// ✅ You should add them in the beforeEach hook:
export const MyStory = {
  beforeEach({ msw }) {
    msw.use(...) // some handlers here
  }
}
```

`parameters.msw` keeps working in v3 in CSF 3.0 setups only — it is preserved to make migration easier and will be removed in the next major release. It is not supported in [CSF Next](#new-csf-next-support).

### New: CSF Next support

If you are using the [CSF Next](https://storybook.js.org/docs/api/csf/csf-next) syntax (also known as CSF Factories), you don't need the loader at all. Import and call the addon function in `preview.ts`:

```ts
// .storybook/preview.ts
import addonMsw from 'msw-storybook-addon'

export default definePreview({
  addons: [addonMsw()],
})
```

`addonMsw` accepts the same custom setup function as `mswLoader` in case you need to customize the worker. Note that `parameters.msw` is not supported in CSF Next — use the `beforeEach` hook instead.

## From 1.x.x to 2.x.x

### MSW required version is now ^2.0.0

The addon now requires your MSW version to be 2.0.0 or higher. This means you will have to change the format of your handlers as well. More info on how to migrate to MSW 2.0.0: https://mswjs.io/docs/migrations/1.x-to-2.x/

### mswDecorator is deprecated in favor of mswLoader

Using MSW in a decorator worked for most scenarios, but there's a slight chance the service worker will not get registered in time. As a result, a story that requests data might actually request real data. **Since v1.7.0**, this addon provided a `mswLoader` to use instead of the `mswDecorator`. Loaders get executed before a story renders, differently than decorators, which execute as the story renders.

Please replace your `mswDecorator` with `mswLoader`, as the `mswDecorator` will be removed in the next major release. It works the same, respecting the parameters you set, so there's no need to change anything else in your codebase.

```diff
// .storybook/preview.js
-import { initialize, mswDecorator } from 'msw-storybook-addon'
+import { initialize, mswLoader } from 'msw-storybook-addon'

initialize()

const preview = {
-  decorators: [mswDecorator]
+  loaders: [mswLoader]
}

export default preview
```

### parameters.msw Array notation deprecated in favor of Object notation

**Since v1.5.0**, this addon started supporting the `parameters.msw.handlers` object format instead of using `parameters.msw` as an Array. This change was done to follow convention for Storybook addon parameters, but also allows for more advanced usage and make the addon more future proof for upcoming features. You can find [more information here](./README.md#composing-request-handlers).

Please migrate to this format, and the previous format will be removed in the next major release.

```ts
// ❌ Instead of defining the msw parameter like so:
export const MyStory = {
  parameters: {
    msw: [...] // some handlers here
  }
}

// ✅ You should set them like so:
export const MyStory = {
  parameters: {
    msw: {
      handlers: [...] // some handlers here
    }
  }
}
// ✅ Or like so:
export const MyStory = {
  parameters: {
    msw: {
      handlers: {
        someHandlerName: [...] // some handlers here
      }
    }
  }
}
```
