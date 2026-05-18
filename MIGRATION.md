<h1>Migration</h1>

- [From 2.x.x to 3.x.x](#from-2xx-to-3xx)
  - [Automated migration](#automated-migration)
  - [Handlers move from `parameters.msw` to `beforeEach({ msw })`](#handlers-move-from-parametersmsw-to-beforeeach-msw-)
  - [`mswLoader` and `mswDecorator` are removed](#mswloader-and-mswdecorator-are-removed)
  - [`initialize()` is now only for CSF 3.0 customization](#initialize-is-now-only-for-csf-30-customization)
- [From 1.x.x to 2.x.x](#from-1xx-to-2xx)
  - [MSW required version is now ^2.0.0](#msw-required-version-is-now-200)
  - [mswDecorator is deprecated in favor of mswLoader](#mswdecorator-is-deprecated-in-favor-of-mswloader)
  - [parameters.msw Array notation deprecated in favor of Object notation](#parametersmsw-array-notation-deprecated-in-favor-of-object-notation)

## From 2.x.x to 3.x.x

3.x reworks how handlers are provided. Instead of declaring handlers as
`parameters.msw` and registering an `mswLoader`, you now receive a live
`msw` worker on the story context and call `msw.use(...)` from a
`beforeEach` hook. This removes the long-standing race where the service
worker could fail to register before a story rendered: the worker is now
started and awaited before any story (or its `play` function) runs.

### Automated migration

Run the bundled codemod from your project root:

```sh
npx msw-storybook-migrate
```

It rewrites recognised `parameters.msw` shapes into `beforeEach({ msw })`,
removes `mswLoader` wiring from `.storybook/preview.*`, ensures
`msw-storybook-addon` is in `.storybook/main.*` `addons`, and adds
`mswAddon()` to `definePreview({ addons: [...] })` if you use CSF factories.
Use `--dry-run` to preview changes, `--help` for options. Stories whose
`parameters.msw` uses an unrecognised shape are reported and must be
hand-migrated using the pattern below.

### Handlers move from `parameters.msw` to `beforeEach({ msw })`

```diff
 export const UserProfile = {
-  parameters: {
-    msw: {
-      handlers: [
-        http.get('https://api.acme.com/user', () => HttpResponse.json({ name: 'John' })),
-      ],
-    },
-  },
+  beforeEach({ msw }) {
+    msw.use(
+      http.get('https://api.acme.com/user', () => HttpResponse.json({ name: 'John' })),
+    )
+  },
 }
```

Global handlers move the same way, from `parameters.msw` in `preview.*` to a
top-level `beforeEach({ msw })`.

### `mswLoader` and `mswDecorator` are removed

The addon's `beforeEach` now builds and awaits the worker automatically, so
there is nothing to register. Remove the `mswLoader`/`mswDecorator` import
and any `loaders: [mswLoader]` / `decorators: [mswDecorator]` entry from
`.storybook/preview.*` (the codemod does this for you).

### `initialize()` is now only for CSF 3.0 customization

You no longer need to call `initialize()` for the addon to work — it is
auto-wired. Keep `initialize(options, initialHandlers)` only if you are using
CSF 3.0 and need custom `start()` options or initial handlers.
When using [CSF factories](https://storybook.js.org/docs/api/csf/csf-next) path, pass a setup function to `mswAddon(setup)` instead.

`initialize` has also moved to a dedicated subpath so the main entry stays
free of `msw/browser`. Update the import:

```diff
-import { initialize } from 'msw-storybook-addon'
+import { initialize } from 'msw-storybook-addon/csf3'
```

Other exports like `MswApi` remain on the main
`msw-storybook-addon` entry.

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
