import { describe, expect, it } from 'vitest'
import { transformMain } from '../src/transforms/main'
import { dedent } from 'ts-dedent'

describe('transformMain', () => {
  it('adds the addon when missing', () => {
    const src = dedent`
      import type { StorybookConfig } from '@storybook/react-vite'
      export default {
        framework: '@storybook/react-vite',
        stories: ['../src/**/*.stories.tsx'],
        addons: ['@storybook/addon-essentials'],
      } satisfies StorybookConfig
    `
    expect(transformMain(src)).toMatchInlineSnapshot(`
      "import type { StorybookConfig } from '@storybook/react-vite'
      export default {
        framework: '@storybook/react-vite',
        stories: ['../src/**/*.stories.tsx'],
        addons: ['@storybook/addon-essentials', 'msw-storybook-addon'],
      } satisfies StorybookConfig"
    `)
  })

  it('is idempotent when the addon is already a bare string', () => {
    const src = dedent`
      export default {
        addons: ['msw-storybook-addon'],
      }
    `
    expect(transformMain(src)).toBeNull()
  })

  it('is idempotent when the addon is already in object form', () => {
    const src = dedent`
      export default {
        addons: [{ name: 'msw-storybook-addon', options: {} }],
      }
    `
    expect(transformMain(src)).toBeNull()
  })

  it('is idempotent when the addon is already wrapped in getAbsolutePath', () => {
    const src = dedent`
      function getAbsolutePath(value) {
        return dirname(require.resolve(join(value, 'package.json')))
      }
      export default {
        addons: [getAbsolutePath('msw-storybook-addon')],
      }
    `
    expect(transformMain(src)).toBeNull()
  })

  it('is idempotent when the addon is in object form with a wrapped name', () => {
    const src = dedent`
      export default {
        addons: [{ name: getAbsolutePath('msw-storybook-addon'), options: {} }],
      }
    `
    expect(transformMain(src)).toBeNull()
  })

  it('follows the getAbsolutePath convention of existing entries', () => {
    const src = dedent`
      import type { StorybookConfig } from '@storybook/react-vite'
      export default {
        framework: getAbsolutePath('@storybook/react-vite'),
        addons: [getAbsolutePath('@storybook/addon-docs')],
      } satisfies StorybookConfig
    `
    expect(transformMain(src)).toMatchInlineSnapshot(`
      "import type { StorybookConfig } from '@storybook/react-vite'
      export default {
        framework: getAbsolutePath('@storybook/react-vite'),
        addons: [
          getAbsolutePath('@storybook/addon-docs'),
          getAbsolutePath('msw-storybook-addon')
        ],
      } satisfies StorybookConfig"
    `)
  })

  it('follows any single-string-argument resolver convention, not just getAbsolutePath', () => {
    const src = dedent`
      export default {
        addons: [wrapForPnp('@storybook/addon-docs')],
      }
    `
    expect(transformMain(src)).toMatchInlineSnapshot(`
      "export default {
        addons: [wrapForPnp('@storybook/addon-docs'), wrapForPnp('msw-storybook-addon')],
      }"
    `)
  })

  it('handles a defineMain-wrapped config', () => {
    const src = dedent`
      import { defineMain } from '@storybook/react-vite/node'

      export default defineMain({
        framework: '@storybook/react-vite',
        addons: ['@storybook/addon-docs'],
      })
    `
    expect(transformMain(src)).toMatchInlineSnapshot(`
      "import { defineMain } from '@storybook/react-vite/node'

      export default defineMain({
        framework: '@storybook/react-vite',
        addons: ['@storybook/addon-docs', 'msw-storybook-addon'],
      })"
    `)
  })

  it('creates the addons array if missing', () => {
    const src = dedent`
      export default {
        framework: '@storybook/react-vite',
        stories: ['../src/**/*.stories.tsx'],
      }
    `
    expect(transformMain(src)).toMatchInlineSnapshot(`
      "export default {
        framework: '@storybook/react-vite',
        stories: ['../src/**/*.stories.tsx'],
        addons: ['msw-storybook-addon']
      };"
    `)
  })

  it('returns null when addons is not a plain array (e.g. spread variable)', () => {
    const src = dedent`
      import { sharedAddons } from './shared'
      export default {
        addons: sharedAddons,
      }
    `
    expect(transformMain(src)).toBeNull()
  })
})
