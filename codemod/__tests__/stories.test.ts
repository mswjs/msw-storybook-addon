import { describe, expect, it } from 'vitest'
import { transformStory } from '../src/transforms/stories'
import { dedent } from 'ts-dedent'

// Each test pins the full `transformStory` result as an inline snapshot so
// the exact rewrite (parameters.msw -> beforeEach({ msw }), other params
// preserved) and the skip behaviour are reviewable in the diff.

describe('transformStory', () => {
  it('returns null when the file has no parameters.msw (idempotent)', () => {
    const src = dedent`
      import type { Meta, StoryObj } from '@storybook/react-vite'
      const meta: Meta = { title: 'X' }
      export default meta
      export const Foo: StoryObj = { args: { x: 1 } }
    `
    expect(transformStory(src).code).toBeNull()
  })

  it('returns null when the file already uses beforeEach({ msw }) (idempotent)', () => {
    const src = dedent`
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
    const src = dedent`
      import { http, HttpResponse } from 'msw'
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
        beforeEach({ msw }) {
          msw.use(http.get('/u', () => HttpResponse.json({ name: 'A' })))
        }
      }"
    `)
  })

  it('migrates CSF3 meta-level parameters.msw', () => {
    const src = dedent`
      import { http, HttpResponse } from 'msw'
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

        beforeEach({ msw }) {
          msw.use(http.get('/u', () => HttpResponse.json({})))
        }
      }
      export default meta"
    `)
  })

  it('migrates legacy array form parameters: { msw: [...handlers] }', () => {
    const src = dedent`
      import { http, HttpResponse } from 'msw'
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
        beforeEach({ msw }) {
          msw.use(http.get('/u', () => HttpResponse.json({})))
        }
      }"
    `)
  })

  it('flattens named-object handlers into msw.use(...)', () => {
    const src = dedent`
      import { http, HttpResponse } from 'msw'
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
        beforeEach({ msw }) {
          msw.use(
            http.get('/u', () => HttpResponse.json({})),
            http.get('/p', () => HttpResponse.json({}))
          )
        }
      }"
    `)
  })

  it('preserves other parameters keys', () => {
    const src = dedent`
      import { http, HttpResponse } from 'msw'
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
        beforeEach({ msw }) {
          msw.use(http.get('/u', () => HttpResponse.json({})))
        },

        parameters: {
          layout: 'centered'
        }
      }"
    `)
  })

  it('drops an empty parameters.msw without emitting a beforeEach', () => {
    const src = dedent`
      export default { title: 'X' }
      export const Foo = {
        parameters: {
          layout: 'centered',
          msw: [],
        },
      }
    `
    expect(transformStory(src)).toMatchInlineSnapshot(`
      {
        "code": "export default { title: 'X' }
      export const Foo = {
        parameters: {
          layout: 'centered'
        },
      }",
        "skippedStories": [],
      }
    `)
  })

  it('skips a story whose beforeEach already exists', () => {
    const src = dedent`
      import { http, HttpResponse } from 'msw'
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
          {
            "reason": "existing-before-each",
            "story": "Foo",
          },
        ],
      }
    `)
  })

  it('skips an unrecognised parameters.msw shape', () => {
    const src = dedent`
      export default { title: 'X' }
      export const Foo = {
        parameters: { msw: someExternalThing },
      }
    `
    expect(transformStory(src)).toMatchInlineSnapshot(`
      {
        "code": null,
        "skippedStories": [
          {
            "reason": "unrecognized-shape",
            "story": "Foo",
          },
        ],
      }
    `)
  })

  it('preserves TypeScript type annotations (satisfies)', () => {
    const src = dedent`
      import { http, HttpResponse } from 'msw'
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
        beforeEach({ msw }) {
          msw.use(http.get('/u', () => HttpResponse.json({})))
        }
      }"
    `)
  })

  it('migrates parameters.msw in CSF factory files (preview.meta / meta.story)', () => {
    const src = dedent`
      import preview from '../../../.storybook/preview'
      import { http, HttpResponse } from 'msw'

      const meta = preview.meta({
        title: 'Pages/HomePage',
        parameters: {
          layout: 'fullscreen',
          msw: {
            handlers: [http.get('/x', () => HttpResponse.json({}))],
          },
        },
      })

      export const Default = meta.story()

      export const WithParams = meta.story({
        parameters: {
          msw: [http.get('/y', () => HttpResponse.json({}))],
        },
      })
    `
    expect(transformStory(src).code).toMatchInlineSnapshot(`
      "import preview from '../../../.storybook/preview'
      import { http, HttpResponse } from 'msw'

      const meta = preview.meta({
        title: 'Pages/HomePage',

        beforeEach({ msw }) {
          msw.use(http.get('/x', () => HttpResponse.json({})))
        },

        parameters: {
          layout: 'fullscreen'
        }
      })

      export const Default = meta.story()

      export const WithParams = meta.story({
        beforeEach({ msw }) {
          msw.use(http.get('/y', () => HttpResponse.json({})))
        }
      })"
    `)
  })

  it('migrates the v1-style Foo.story = { parameters: { msw: ... } } annotation', () => {
    const src = dedent`
      import { http, HttpResponse } from 'msw'
      export default { title: 'X' }
      export const Foo = () => null
      Foo.story = {
        name: 'Custom name',
        parameters: {
          msw: { handlers: [http.get('/u', () => HttpResponse.json({}))] },
        },
      }
    `
    expect(transformStory(src).code).toMatchInlineSnapshot(`
      "import { http, HttpResponse } from 'msw'
      export default { title: 'X' }
      export const Foo = () => null
      Foo.story = {
        name: 'Custom name'
      }

      Foo.beforeEach = ({ msw }) => {
        msw.use(http.get('/u', () => HttpResponse.json({})))
      };"
    `)
  })

  it('drops a v1-style Foo.story annotation entirely when it empties', () => {
    const src = dedent`
      import { http, HttpResponse } from 'msw'
      export default { title: 'X' }
      export const Foo = () => null
      Foo.story = {
        parameters: {
          msw: [http.get('/u', () => HttpResponse.json({}))],
        },
      }
    `
    expect(transformStory(src).code).toMatchInlineSnapshot(`
      "import { http, HttpResponse } from 'msw'
      export default { title: 'X' }
      export const Foo = () => null
      Foo.beforeEach = ({ msw }) => {
        msw.use(http.get('/u', () => HttpResponse.json({})))
      };"
    `)
  })

  it('skips a CSF2 story that already has a beforeEach annotation', () => {
    const src = dedent`
      import { http, HttpResponse } from 'msw'
      export default { title: 'X' }
      export const Foo = () => null
      Foo.beforeEach = ({ msw }) => {}
      Foo.parameters = {
        msw: [http.get('/u', () => HttpResponse.json({}))],
      }
    `
    expect(transformStory(src)).toMatchInlineSnapshot(`
      {
        "code": null,
        "skippedStories": [
          {
            "reason": "existing-before-each",
            "story": "Foo",
          },
        ],
      }
    `)
  })

  it('migrates CSF2-style Foo.parameters = { msw: ... } annotation', () => {
    const src = dedent`
      import { http, HttpResponse } from 'msw'
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
      Foo.beforeEach = ({ msw }) => {
        msw.use(http.get('/u', () => HttpResponse.json({})))
      };"
    `)
  })
})
