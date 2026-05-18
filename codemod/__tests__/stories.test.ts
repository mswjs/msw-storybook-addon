import { describe, expect, it } from 'vitest'
import { transformStory } from '../src/transforms/stories'

// Each test pins the full `transformStory` result as an inline snapshot so
// the exact rewrite (parameters.msw -> beforeEach({ msw }), other params
// preserved) and the skip behaviour are reviewable in the diff.

describe('transformStory', () => {
  it('returns null when the file has no parameters.msw (idempotent)', () => {
    const src = `
      import type { Meta, StoryObj } from '@storybook/react-vite'
      const meta: Meta = { title: 'X' }
      export default meta
      export const Foo: StoryObj = { args: { x: 1 } }
    `
    expect(transformStory(src).code).toBeNull()
  })

  it('returns null when the file already uses beforeEach({ msw }) (idempotent)', () => {
    const src = `
      import { http, HttpResponse } from 'msw'
      export default { title: 'X' }
      export const Foo = {
        beforeEach({ msw }) {
          msw.use(http.get('/u', () => HttpResponse.json({})))
        }
      }
    `
    expect(transformStory(src).code).toBeNull()
  })

  it('migrates CSF3 story with parameters.msw.handlers (array)', () => {
    const src = `import { http, HttpResponse } from 'msw'
export default { title: 'X' }
export const Foo = {
  parameters: {
    msw: {
      handlers: [
        http.get('/u', () => HttpResponse.json({ name: 'A' })),
      ],
    },
  },
}
`
    expect(transformStory(src).code).toMatchInlineSnapshot(`
      "import { http, HttpResponse } from 'msw'
      export default { title: 'X' }
      export const Foo = {
        beforeEach(
          {
            msw
          }
        ) {
          msw.use(http.get('/u', () => HttpResponse.json({ name: 'A' })));
        }
      }
      "
    `)
  })

  it('migrates CSF3 meta-level parameters.msw', () => {
    const src = `import { http, HttpResponse } from 'msw'
const meta = {
  title: 'X',
  parameters: {
    msw: { handlers: [http.get('/u', () => HttpResponse.json({}))] },
  },
}
export default meta
`
    expect(transformStory(src).code).toMatchInlineSnapshot(`
      "import { http, HttpResponse } from 'msw'
      const meta = {
        title: 'X',

        beforeEach(
          {
            msw
          }
        ) {
          msw.use(http.get('/u', () => HttpResponse.json({})));
        }
      }
      export default meta
      "
    `)
  })

  it('migrates legacy array form parameters: { msw: [...handlers] }', () => {
    const src = `import { http, HttpResponse } from 'msw'
export default { title: 'X' }
export const Foo = {
  parameters: {
    msw: [
      http.get('/u', () => HttpResponse.json({})),
    ],
  },
}
`
    expect(transformStory(src).code).toMatchInlineSnapshot(`
      "import { http, HttpResponse } from 'msw'
      export default { title: 'X' }
      export const Foo = {
        beforeEach(
          {
            msw
          }
        ) {
          msw.use(http.get('/u', () => HttpResponse.json({})));
        }
      }
      "
    `)
  })

  it('flattens named-object handlers into msw.use(...)', () => {
    const src = `import { http, HttpResponse } from 'msw'
export default { title: 'X' }
export const Foo = {
  parameters: {
    msw: {
      handlers: {
        user: [http.get('/u', () => HttpResponse.json({}))],
        product: http.get('/p', () => HttpResponse.json({})),
      },
    },
  },
}
`
    expect(transformStory(src).code).toMatchInlineSnapshot(`
      "import { http, HttpResponse } from 'msw'
      export default { title: 'X' }
      export const Foo = {
        beforeEach(
          {
            msw
          }
        ) {
          msw.use(
            http.get('/u', () => HttpResponse.json({})),
            http.get('/p', () => HttpResponse.json({}))
          );
        }
      }
      "
    `)
  })

  it('preserves other parameters keys', () => {
    const src = `import { http, HttpResponse } from 'msw'
export default { title: 'X' }
export const Foo = {
  parameters: {
    layout: 'centered',
    msw: { handlers: [http.get('/u', () => HttpResponse.json({}))] },
  },
}
`
    expect(transformStory(src).code).toMatchInlineSnapshot(`
      "import { http, HttpResponse } from 'msw'
      export default { title: 'X' }
      export const Foo = {
        beforeEach(
          {
            msw
          }
        ) {
          msw.use(http.get('/u', () => HttpResponse.json({})));
        },

        parameters: {
          layout: 'centered'
        }
      }
      "
    `)
  })

  it('skips a story whose beforeEach already exists', () => {
    const src = `import { http, HttpResponse } from 'msw'
export default { title: 'X' }
export const Foo = {
  beforeEach() { /* user logic */ },
  parameters: {
    msw: { handlers: [http.get('/u', () => HttpResponse.json({}))] },
  },
}
`
    expect(transformStory(src)).toMatchInlineSnapshot(`
      {
        "code": null,
        "skippedStories": [
          "Foo",
        ],
      }
    `)
  })

  it('skips an unrecognised parameters.msw shape', () => {
    const src = `export default { title: 'X' }
export const Foo = {
  parameters: { msw: someExternalThing },
}
`
    expect(transformStory(src)).toMatchInlineSnapshot(`
      {
        "code": null,
        "skippedStories": [
          "Foo",
        ],
      }
    `)
  })

  it('preserves TypeScript type annotations (satisfies)', () => {
    const src = `import { http, HttpResponse } from 'msw'
import type { Meta, StoryObj } from '@storybook/react-vite'
const meta = { title: 'X' } satisfies Meta<unknown>
export default meta
type Story = StoryObj<typeof meta>
export const Foo: Story = {
  parameters: {
    msw: { handlers: [http.get('/u', () => HttpResponse.json({}))] },
  },
}
`
    expect(transformStory(src).code).toMatchInlineSnapshot(`
      "import { http, HttpResponse } from 'msw'
      import type { Meta, StoryObj } from '@storybook/react-vite'
      const meta = { title: 'X' } satisfies Meta<unknown>
      export default meta
      type Story = StoryObj<typeof meta>
      export const Foo: Story = {
        beforeEach(
          {
            msw
          }
        ) {
          msw.use(http.get('/u', () => HttpResponse.json({})));
        }
      }
      "
    `)
  })

  it('migrates CSF2-style Foo.parameters = { msw: ... } annotation', () => {
    const src = `import { http, HttpResponse } from 'msw'
export default { title: 'X' }
export const Foo = () => null
Foo.parameters = {
  msw: { handlers: [http.get('/u', () => HttpResponse.json({}))] },
}
`
    expect(transformStory(src).code).toMatchInlineSnapshot(`
      "import { http, HttpResponse } from 'msw'
      export default { title: 'X' }
      export const Foo = () => null
      Foo.beforeEach = (
        {
          msw
        }
      ) => {
        msw.use(http.get('/u', () => HttpResponse.json({})));
      };
      "
    `)
  })
})
