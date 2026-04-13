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

```ts
// .storybook/main.ts
export default {
  addons: ['msw-storybook-addon'],
}
```

Include the addon's types in your `tsconfig.json` to have the `StoryContext` type extended automatically in all your stories:

```json
{
  "compilerOptions": {
    "types": ["msw-storybook-addon/types"]
  }
}
```

#### CSF Factories

If you are using the CSF Factory syntax, it's enough to import and call the addon function in `preview.ts`:

```ts
// .storybook/preview.ts
import addonMsw from 'msw-storybook-addon'

export default definePreview({
  addons: [addonMsw()],
})
```

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
