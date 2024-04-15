<h1>Migration</h1>

- [From 1.x.x to 2.x.x](#from-1xx-to-2xx)
  - [MSW required version is now ^2.0.0](#msw-required-version-is-now-200)
  - [mswDecorator is deprecated in favor of mswLoader](#mswdecorator-is-deprecated-in-favor-of-mswloader)
  - [parameters.msw Array notation deprecated in favor of Object notation](#parametersmsw-array-notation-deprecated-in-favor-of-object-notation)

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
