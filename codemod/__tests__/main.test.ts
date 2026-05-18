import { describe, expect, it } from 'vitest'
import { transformMain } from '../src/transforms/main'

// Each test pins the full transformed output as an inline snapshot so the
// exact rewrite is reviewable in the diff. Idempotent cases assert `null`
// (the transform signals "nothing to do" by returning null).

describe('transformMain', () => {
  it('adds the addon when missing', () => {
    const src = `import type { StorybookConfig } from '@storybook/react-vite'
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
        addons: ['@storybook/addon-essentials', "msw-storybook-addon"],
      } satisfies StorybookConfig
      "
    `)
  })

  it('is idempotent when the addon is already a bare string', () => {
    const src = `export default {
  addons: ['msw-storybook-addon'],
}
`
    expect(transformMain(src)).toBeNull()
  })

  it('is idempotent when the addon is already in object form', () => {
    const src = `export default {
  addons: [{ name: 'msw-storybook-addon', options: {} }],
}
`
    expect(transformMain(src)).toBeNull()
  })

  it('creates the addons array if missing', () => {
    const src = `export default {
  framework: '@storybook/react-vite',
  stories: ['../src/**/*.stories.tsx'],
}
`
    expect(transformMain(src)).toMatchInlineSnapshot(`
      "export default {
        framework: '@storybook/react-vite',
        stories: ['../src/**/*.stories.tsx'],
        addons: ["msw-storybook-addon"]
      };
      "
    `)
  })

  it('returns null when addons is not a plain array (e.g. spread variable)', () => {
    const src = `import { sharedAddons } from './shared'
export default {
  addons: sharedAddons,
}
`
    expect(transformMain(src)).toBeNull()
  })
})
