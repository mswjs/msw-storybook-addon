<h1>Migration</h1>

- [From 1.x.x to 2.x.x](#from-1xx-to-2xx)
  - [MSW required version is now ^2.0.0](#msw-required-version-is-now-200)
  - [mswDecorator is deprecated in favor of mswLoader](#mswdecorator-is-deprecated-in-favor-of-mswloader)

## From 1.x.x to 2.x.x

### MSW required version is now ^2.0.0

The addon now requires your MSW version to be 2.0.0 or higher. This means you will have to change the format of your handlers as well. More info on how to migrate to MSW 2.0.0: https://mswjs.io/docs/migrations/1.x-to-2.x/

### mswDecorator is deprecated in favor of mswLoader

Using MSW in a decorator worked for most scenarios, but there's a slight chance the service worker will not get registered in time. As a result, a story that requests data might actually request real data. Since v1.7.0, this addon provided a `mswLoader` to use instead of the `mswDecorator`. Loaders get executed before a story renders, differently than decorators, which execute as the story renders. Please replace your `mswDecorator` with `mswLoader`, as the `mswDecorator` will be removed in the next major release. It works the same, respecting the parameters you set, so there's no need to change anything else in your codebase.

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
