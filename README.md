# MSW Storybook Addon

Mock API requests in Storybook with Mock Service Worker.

## Usage

### Install

```sh
npm i msw-storybook-addon -D
```

### Generate the worker script

```sh
npx msw init ./public --save
```

### Configure Storybook

#### CSF 3.0

```ts
// .storybook/main.ts
export default {
  addons: ['msw-storybook-addon'],
}
```

```json
{
  "compilerOptions": {
    "types": ["msw-storybook-addon/types"]
  }
}
```

#### CSF Factories

```ts
// .storybook/preview.ts
import addonMsw from 'msw-storybook-addon'

export default definePreview({
  addons: [addonMsw()],
})
```

### Provide handlers

#### Global handlers

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
