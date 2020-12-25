# MSW Storybook addon

* Mock Rest and Graphql requests right inside your story.
* Document how a component behaves in various scenarios.
* Get a11y, snapshot and visual tests using other addons for free.

[Full Documentation](https://msw-sb.netlify.app/)

## Quick Start

1. Install msw & storybook addon.

```sh
npm i -D msw msw-storybook-addon
```

2. Enable msw on storybook by adding these lines in `./storybook/preview.js`

```js
import { addDecorator } from '@storybook/react';
import { initializeWorker, mswDecorator } from 'msw-storybook-addon';

initializeWorker();
addDecorator(mswDecorator);
```

3. Generate service worker for msw in your public folder.

```sh
npx msw init public/
```

Refer [MSW official guide](https://mswjs.io/docs/getting-started/integrate/browser) for framework specific paths.

4. Start storybook with that public folder.

```sh
npx start-storybook -s public -p 6006
```

5. Mock API calls in a story.

```js
import { rest } from 'msw';

export const DefaultBehavior = () => <UserProfile />;

DefaultBehavior.story = {
  parameters: {
    msw: [
      rest.get('/user', (req, res, ctx) => {
        return res(
          ctx.json({
            firstName: 'Neil',
            lastName: 'Maverick',
          }),
        );
      }),
    ]
  },
};
```

The msw parameter takes an array of handlers as shown in [MSW official guide](https://mswjs.io/docs/getting-started/mocks/rest-api).
