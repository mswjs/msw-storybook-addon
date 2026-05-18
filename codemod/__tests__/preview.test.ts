import { describe, expect, it } from 'vitest'
import { transformPreview } from '../src/transforms/preview'

// Each test pins the full transformed output as an inline snapshot so the
// exact rewrite (import edits, loader removal, addon injection) is
// reviewable in the diff. Idempotent cases assert `null`.

describe('transformPreview', () => {
  it('returns null when there is no msw-storybook-addon usage (idempotent)', () => {
    const src = `
      export default { parameters: {} }
    `
    expect(transformPreview(src)).toBeNull()
  })

  it('strips mswLoader from a CSF3 plain-object preview', () => {
    const src = `import { initialize, mswLoader } from 'msw-storybook-addon'

initialize({ onUnhandledRequest: 'bypass' })

const preview = {
  loaders: [mswLoader],
  parameters: { actions: { argTypesRegex: '^on[A-Z].*' } },
}
export default preview
`
    expect(transformPreview(src)).toMatchInlineSnapshot(`
      "import { initialize } from "msw-storybook-addon/csf3";

      initialize({ onUnhandledRequest: 'bypass' })

      const preview = {
        parameters: { actions: { argTypesRegex: '^on[A-Z].*' } }
      }
      export default preview
      "
    `)
  })

  it('handles the loaders: mswLoader shorthand', () => {
    const src = `import { initialize, mswLoader } from 'msw-storybook-addon'
initialize()
export default { loaders: mswLoader }
`
    expect(transformPreview(src)).toMatchInlineSnapshot(`
      "import { initialize } from "msw-storybook-addon/csf3";
      initialize()
      export default {};
      "
    `)
  })

  it('keeps other loaders when mswLoader is one of many', () => {
    const src = `import { initialize, mswLoader } from 'msw-storybook-addon'
import { otherLoader } from 'somewhere'
initialize()
export default { loaders: [mswLoader, otherLoader] }
`
    expect(transformPreview(src)).toMatchInlineSnapshot(`
      "import { initialize } from "msw-storybook-addon/csf3";
      import { otherLoader } from 'somewhere'
      initialize()
      export default { loaders: [otherLoader] }
      "
    `)
  })

  it('leaves initialize() call sites alone regardless of arguments', () => {
    // Real-world: function-form onUnhandledRequest closing over an outer const.
    const src = `import { initialize, mswLoader } from 'msw-storybook-addon'
const ignoredPattern = /\\.(png|svg)$/i
initialize({
  quiet: true,
  onUnhandledRequest: ({ url }, print) => {
    if (ignoredPattern.test(url)) return
    print.warning()
  },
}, [])
export default { loaders: [mswLoader] }
`
    expect(transformPreview(src)).toMatchInlineSnapshot(`
      "import { initialize } from "msw-storybook-addon/csf3";
      const ignoredPattern = /\\.(png|svg)$/i
      initialize({
        quiet: true,
        onUnhandledRequest: ({ url }, print) => {
          if (ignoredPattern.test(url)) return
          print.warning()
        },
      }, [])
      export default {};
      "
    `)
  })

  it('is idempotent — an already-migrated file is left untouched', () => {
    const src = `import { initialize } from 'msw-storybook-addon/csf3'
initialize()
export default { parameters: {} }
`
    expect(transformPreview(src)).toBeNull()
  })

  it('moves a standalone initialize import to the /csf3 subpath', () => {
    const src = `import { initialize } from 'msw-storybook-addon'
initialize({ onUnhandledRequest: 'bypass' })
export default { parameters: {} }
`
    expect(transformPreview(src)).toMatchInlineSnapshot(`
      "import { initialize } from "msw-storybook-addon/csf3"
      initialize({ onUnhandledRequest: 'bypass' })
      export default { parameters: {} }
      "
    `)
  })

  it('moves an aliased initialize import to the /csf3 subpath', () => {
    const src = `import { initialize as init } from 'msw-storybook-addon'
init()
export default { parameters: {} }
`
    expect(transformPreview(src)).toMatchInlineSnapshot(`
      "import { initialize as init } from "msw-storybook-addon/csf3"
      init()
      export default { parameters: {} }
      "
    `)
  })

  it('strips mswDecorator (decorators array + shorthand)', () => {
    const src = `import { initialize, mswDecorator } from 'msw-storybook-addon'
import { other } from 'x'
initialize()
export default {
  decorators: [mswDecorator, other],
}
`
    expect(transformPreview(src)).toMatchInlineSnapshot(`
      "import { initialize } from "msw-storybook-addon/csf3";
      import { other } from 'x'
      initialize()
      export default {
        decorators: [other],
      }
      "
    `)
  })

  it('removes the decorators key when mswDecorator was the only one', () => {
    const src = `import { initialize, mswDecorator } from 'msw-storybook-addon'
initialize()
export default { decorators: [mswDecorator] }
`
    expect(transformPreview(src)).toMatchInlineSnapshot(`
      "import { initialize } from "msw-storybook-addon/csf3";
      initialize()
      export default {};
      "
    `)
  })

  // -- Factories path ----------------------------------------------------

  it('factories: injects mswAddon() into definePreview addons if missing', () => {
    const src = `import { definePreview } from '@storybook/react-vite'

export default definePreview({
  parameters: {},
})
`
    expect(transformPreview(src)).toMatchInlineSnapshot(`
      "import mswAddon from "msw-storybook-addon";
      import { definePreview } from '@storybook/react-vite'

      export default definePreview({
        addons: [mswAddon()],
        parameters: {}
      })
      "
    `)
  })

  it('factories: leaves an already-registered mswAddon() alone', () => {
    const src = `import { definePreview } from '@storybook/react-vite'
import mswAddon from 'msw-storybook-addon'

export default definePreview({
  addons: [mswAddon()],
})
`
    expect(transformPreview(src)).toBeNull()
  })

  it('factories: moves initialize to /csf3 and adds a separate mswAddon import', () => {
    const src = `import { definePreview } from '@storybook/react-vite'
import { initialize } from 'msw-storybook-addon'

export default definePreview({
  parameters: {},
})
`
    expect(transformPreview(src)).toMatchInlineSnapshot(`
      "import mswAddon from "msw-storybook-addon";
      import { definePreview } from '@storybook/react-vite'
      import { initialize } from "msw-storybook-addon/csf3"

      export default definePreview({
        addons: [mswAddon()],
        parameters: {}
      })
      "
    `)
  })
})
