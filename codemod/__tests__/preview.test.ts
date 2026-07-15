import { describe, expect, it } from 'vitest'
import { transformPreview } from '../src/transforms/preview'
import { dedent } from 'ts-dedent'

describe('transformPreview — CSF 3.0', () => {
  it('returns null when there is no msw-storybook-addon usage', () => {
    const result = transformPreview(`export default { parameters: {} }`)
    expect(result.code).toBeNull()
    expect(result.warnings).toEqual([])
  })

  it('is idempotent — an already-migrated v3 file is left untouched', () => {
    const src = dedent`
      import { mswLoader } from 'msw-storybook-addon/csf3'

      export default {
        loaders: [mswLoader()],
        parameters: {},
      }
    `
    const result = transformPreview(src)
    expect(result.code).toBeNull()
    expect(result.warnings).toEqual([])
  })

  it('migrates the basic v2 wiring: bare initialize() + loaders: [mswLoader]', () => {
    const src = dedent`
      import { initialize, mswLoader } from 'msw-storybook-addon'

      initialize()

      const preview = {
        loaders: [mswLoader],
        parameters: { actions: { argTypesRegex: '^on[A-Z].*' } },
      }
      export default preview
    `
    const result = transformPreview(src)
    expect(result.warnings).toEqual([])
    expect(result.code).toMatchInlineSnapshot(`
      "import { mswLoader } from "msw-storybook-addon/csf3";

      const preview = {
        loaders: [mswLoader()],
        parameters: { actions: { argTypesRegex: '^on[A-Z].*' } },
      }
      export default preview"
    `)
  })

  it('handles the loaders: mswLoader shorthand', () => {
    const src = dedent`
      import { initialize, mswLoader } from 'msw-storybook-addon'
      initialize()
      export default { loaders: mswLoader }
    `
    const result = transformPreview(src)
    expect(result.warnings).toEqual([])
    expect(result.code).toMatchInlineSnapshot(`
      "import { mswLoader } from "msw-storybook-addon/csf3";
      export default { loaders: [mswLoader()] }"
    `)
  })

  it('keeps other loaders when mswLoader is one of many', () => {
    const src = dedent`
      import { initialize, mswLoader } from 'msw-storybook-addon'
      import { otherLoader } from 'somewhere'
      initialize()
      export default { loaders: [mswLoader, otherLoader] }
    `
    const result = transformPreview(src)
    expect(result.warnings).toEqual([])
    expect(result.code).toMatchInlineSnapshot(`
      "import { mswLoader } from "msw-storybook-addon/csf3";
      import { otherLoader } from 'somewhere'
      export default { loaders: [mswLoader(), otherLoader] }"
    `)
  })

  it('folds initialize(options) into a setup function', () => {
    const src = dedent`
      import { initialize, mswLoader } from 'msw-storybook-addon'

      initialize({ onUnhandledRequest: 'bypass' })

      export default { loaders: [mswLoader] }
    `
    const result = transformPreview(src)
    expect(result.warnings).toEqual([])
    expect(result.code).toMatchInlineSnapshot(`
      "import { setupWorker } from "msw/browser";
      import { mswLoader } from "msw-storybook-addon/csf3";

      export default { loaders: [mswLoader(async () => {
        const worker = setupWorker();
        await worker.start({ onUnhandledRequest: 'bypass' });
        return worker;
      })] }"
    `)
  })

  it('folds a function-form onUnhandledRequest verbatim', () => {
    const src = dedent`
      import { initialize, mswLoader } from 'msw-storybook-addon'
      const ignoredPattern = /\\.(png|svg)$/i
      initialize({
        quiet: true,
        onUnhandledRequest: ({ url }, print) => {
          if (ignoredPattern.test(url)) return
          print.warning()
        },
      })
      export default { loaders: [mswLoader] }
    `
    const result = transformPreview(src)
    expect(result.warnings).toEqual([])
    expect(result.code).toMatchInlineSnapshot(`
      "import { setupWorker } from "msw/browser";
      import { mswLoader } from "msw-storybook-addon/csf3";
      const ignoredPattern = /\\.(png|svg)$/i
      export default { loaders: [mswLoader(async () => {
        const worker = setupWorker();

        await worker.start({
          quiet: true,
          onUnhandledRequest: ({ url }, print) => {
            if (ignoredPattern.test(url)) return
            print.warning()
          },
        });

        return worker;
      })] }"
    `)
  })

  it('folds initialize(options, initialHandlers) — array form spreads into setupWorker', () => {
    const src = dedent`
      import { http, HttpResponse } from 'msw'
      import { initialize, mswLoader } from 'msw-storybook-addon'

      initialize({ quiet: true }, [
        http.get('/user', () => HttpResponse.json({ name: 'John' })),
      ])

      export default { loaders: [mswLoader] }
    `
    const result = transformPreview(src)
    expect(result.warnings).toEqual([])
    expect(result.code).toMatchInlineSnapshot(`
      "import { setupWorker } from "msw/browser";
      import { http, HttpResponse } from 'msw'
      import { mswLoader } from "msw-storybook-addon/csf3";

      export default { loaders: [mswLoader(async () => {
        const worker = setupWorker(http.get('/user', () => HttpResponse.json({ name: 'John' })));
        await worker.start({ quiet: true });
        return worker;
      })] }"
    `)
  })

  it('folds initialize(options, handlersIdentifier) — identifier is spread', () => {
    const src = dedent`
      import { initialize, mswLoader } from 'msw-storybook-addon'
      import { sharedHandlers } from './handlers'

      initialize({ quiet: true }, sharedHandlers)

      export default { loaders: [mswLoader] }
    `
    const result = transformPreview(src)
    expect(result.warnings).toEqual([])
    expect(result.code).toMatchInlineSnapshot(`
      "import { setupWorker } from "msw/browser";
      import { mswLoader } from "msw-storybook-addon/csf3";
      import { sharedHandlers } from './handlers'

      export default { loaders: [mswLoader(async () => {
        const worker = setupWorker(...sharedHandlers);
        await worker.start({ quiet: true });
        return worker;
      })] }"
    `)
  })

  it('folds an aliased initialize import', () => {
    const src = dedent`
      import { initialize as init, mswLoader } from 'msw-storybook-addon'
      init({ onUnhandledRequest: 'bypass' })
      export default { loaders: [mswLoader] }
    `
    const result = transformPreview(src)
    expect(result.warnings).toEqual([])
    expect(result.code).toMatchInlineSnapshot(`
      "import { setupWorker } from "msw/browser";
      import { mswLoader } from "msw-storybook-addon/csf3";
      export default { loaders: [mswLoader(async () => {
        const worker = setupWorker();
        await worker.start({ onUnhandledRequest: 'bypass' });
        return worker;
      })] }"
    `)
  })

  it('converts mswDecorator to a loader, keeping other decorators', () => {
    const src = dedent`
      import { initialize, mswDecorator } from 'msw-storybook-addon'
      import { withTheme } from './theme'
      initialize()
      export default { decorators: [mswDecorator, withTheme] }
    `
    const result = transformPreview(src)
    expect(result.warnings).toEqual([])
    expect(result.code).toMatchInlineSnapshot(`
      "import { mswLoader } from "msw-storybook-addon/csf3";
      import { withTheme } from './theme'
      export default {
        loaders: [mswLoader()],
        decorators: [withTheme]
      };"
    `)
  })

  it('drops the decorators key when mswDecorator was the only one', () => {
    const src = dedent`
      import { initialize, mswDecorator } from 'msw-storybook-addon'
      initialize({ onUnhandledRequest: 'bypass' })
      export default { decorators: [mswDecorator] }
    `
    const result = transformPreview(src)
    expect(result.warnings).toEqual([])
    expect(result.code).toMatchInlineSnapshot(`
      "import { setupWorker } from "msw/browser";
      import { mswLoader } from "msw-storybook-addon/csf3";
      export default { loaders: [mswLoader(async () => {
        const worker = setupWorker();
        await worker.start({ onUnhandledRequest: 'bypass' });
        return worker;
      })] }"
    `)
  })

  it('wires the loader for an initialize-only preview', () => {
    const src = dedent`
      import { initialize } from 'msw-storybook-addon'
      initialize()
      export default { parameters: {} }
    `
    const result = transformPreview(src)
    expect(result.warnings).toEqual([])
    expect(result.code).toMatchInlineSnapshot(`
      "import { mswLoader } from "msw-storybook-addon/csf3";
      export default {
        loaders: [mswLoader()],
        parameters: {}
      };"
    `)
  })

  it('handles the "satisfies Preview" form', () => {
    const src = dedent`
      import type { Preview } from '@storybook/react-vite'
      import { initialize, mswLoader } from 'msw-storybook-addon'

      initialize()

      export default {
        loaders: [mswLoader],
      } satisfies Preview
    `
    const result = transformPreview(src)
    expect(result.warnings).toEqual([])
    expect(result.code).toMatchInlineSnapshot(`
      "import type { Preview } from '@storybook/react-vite'
      import { mswLoader } from "msw-storybook-addon/csf3";

      export default {
        loaders: [mswLoader()],
      } satisfies Preview"
    `)
  })

  it('skips and warns when the initialize return value is captured', () => {
    const src = dedent`
      import { initialize, mswLoader } from 'msw-storybook-addon'
      const worker = initialize()
      worker.use()
      export default { loaders: [mswLoader] }
    `
    const result = transformPreview(src)
    expect(result.code).toBeNull()
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('cannot rewrite')
  })

  it('skips and warns when initialize is called conditionally', () => {
    const src = dedent`
      import { initialize, mswLoader } from 'msw-storybook-addon'
      if (process.env.NODE_ENV !== 'test') {
        initialize()
      }
      export default { loaders: [mswLoader] }
    `
    const result = transformPreview(src)
    expect(result.code).toBeNull()
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('cannot rewrite')
  })

  it('skips and warns on multiple initialize calls', () => {
    const src = dedent`
      import { initialize, mswLoader } from 'msw-storybook-addon'
      initialize()
      initialize({ quiet: true })
      export default { loaders: [mswLoader] }
    `
    const result = transformPreview(src)
    expect(result.code).toBeNull()
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('Multiple')
  })

  it('skips and warns on spread arguments to initialize', () => {
    const src = dedent`
      import { initialize, mswLoader } from 'msw-storybook-addon'
      const args = [{ quiet: true }]
      initialize(...args)
      export default { loaders: [mswLoader] }
    `
    const result = transformPreview(src)
    expect(result.code).toBeNull()
    expect(result.warnings).toHaveLength(1)
  })

  it('skips and warns when the loader already carries a setup function', () => {
    const src = dedent`
      import { initialize, mswLoader } from 'msw-storybook-addon/csf3'
      initialize({ quiet: true })
      export default { loaders: [mswLoader(async () => myWorker)] }
    `
    const result = transformPreview(src)
    expect(result.code).toBeNull()
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('setup function')
  })
})

describe('transformPreview — parameters opt-in', () => {
  it('does not touch parameters.msw without the option', () => {
    const src = dedent`
      import { mswLoader } from 'msw-storybook-addon/csf3'
      import { http, HttpResponse } from 'msw'

      export default {
        loaders: [mswLoader()],
        parameters: {
          msw: [http.get('/user', () => HttpResponse.json({}))],
        },
      }
    `
    const result = transformPreview(src)
    expect(result.code).toBeNull()
    expect(result.warnings).toEqual([])
  })

  it('migrates preview-level parameters.msw (array form) to beforeEach', () => {
    const src = dedent`
      import { mswLoader } from 'msw-storybook-addon/csf3'
      import { http, HttpResponse } from 'msw'

      export default {
        loaders: [mswLoader()],
        parameters: {
          msw: [http.get('/user', () => HttpResponse.json({}))],
        },
      }
    `
    const result = transformPreview(src, { migrateParameters: true })
    expect(result.warnings).toEqual([])
    expect(result.code).toMatchInlineSnapshot(`
      "import { mswLoader } from 'msw-storybook-addon/csf3'
      import { http, HttpResponse } from 'msw'

      export default {
        loaders: [mswLoader()],

        beforeEach({ msw }) {
          msw.use(http.get('/user', () => HttpResponse.json({})))
        }
      };"
    `)
  })

  it('migrates the handlers record form and keeps other parameters', () => {
    const src = dedent`
      import { initialize, mswLoader } from 'msw-storybook-addon'
      import { http, HttpResponse } from 'msw'

      initialize()

      export default {
        loaders: [mswLoader],
        parameters: {
          layout: 'centered',
          msw: {
            handlers: {
              user: [http.get('/user', () => HttpResponse.json({}))],
            },
          },
        },
      }
    `
    const result = transformPreview(src, { migrateParameters: true })
    expect(result.warnings).toEqual([])
    expect(result.code).toMatchInlineSnapshot(`
      "import { mswLoader } from "msw-storybook-addon/csf3";
      import { http, HttpResponse } from 'msw'

      export default {
        loaders: [mswLoader()],

        beforeEach({ msw }) {
          msw.use(http.get('/user', () => HttpResponse.json({})))
        },

        parameters: {
          layout: 'centered'
        }
      };"
    `)
  })

  it('warns on unrecognised parameters.msw shapes but still migrates the wiring', () => {
    const src = dedent`
      import { initialize, mswLoader } from 'msw-storybook-addon'
      import { getHandlers } from './handlers'

      initialize()

      export default {
        loaders: [mswLoader],
        parameters: {
          msw: getHandlers(),
        },
      }
    `
    const result = transformPreview(src, { migrateParameters: true })
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('not recognise')
    expect(result.code).toMatchInlineSnapshot(`
      "import { mswLoader } from "msw-storybook-addon/csf3";
      import { getHandlers } from './handlers'

      export default {
        loaders: [mswLoader()],
        parameters: {
          msw: getHandlers(),
        },
      }"
    `)
  })

  it('drops an empty parameters.msw without emitting a beforeEach', () => {
    const src = dedent`
      export default {
        parameters: {
          layout: 'centered',
          msw: [],
        },
      }
    `
    const result = transformPreview(src, { migrateParameters: true })
    expect(result.warnings).toEqual([])
    expect(result.code).toMatchInlineSnapshot(`
      "export default {
        parameters: {
          layout: 'centered'
        },
      }"
    `)
  })

  it('warns instead of overwriting an existing beforeEach', () => {
    const src = dedent`
      import { http, HttpResponse } from 'msw'

      export default {
        beforeEach() {},
        parameters: {
          msw: [http.get('/user', () => HttpResponse.json({}))],
        },
      }
    `
    const result = transformPreview(src, { migrateParameters: true })
    expect(result.code).toBeNull()
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('already defines')
  })
})

describe('transformPreview — CSF Next (definePreview)', () => {
  it('leaves a definePreview file with no msw wiring untouched', () => {
    const src = dedent`
      import { definePreview } from '@storybook/react-vite'

      export default definePreview({
        parameters: {},
      })
    `
    const result = transformPreview(src)
    expect(result.code).toBeNull()
    expect(result.warnings).toEqual([])
  })

  it('leaves an already-registered addonMsw() alone', () => {
    const src = dedent`
      import { definePreview } from '@storybook/react-vite'
      import addonMsw from 'msw-storybook-addon'

      export default definePreview({
        addons: [addonMsw()],
      })
    `
    const result = transformPreview(src)
    expect(result.code).toBeNull()
    expect(result.warnings).toEqual([])
  })

  it('fixes the half-migrated state: strips a leftover loader next to addonMsw()', () => {
    const src = dedent`
      import { definePreview } from '@storybook/react-vite'
      import addonMsw from 'msw-storybook-addon'
      import { mswLoader } from 'msw-storybook-addon/csf3'

      export default definePreview({
        addons: [addonMsw()],
        loaders: [mswLoader()],
      })
    `
    const result = transformPreview(src)
    expect(result.warnings).toEqual([])
    expect(result.code).toMatchInlineSnapshot(`
      "import { definePreview } from '@storybook/react-vite'
      import addonMsw from 'msw-storybook-addon'

      export default definePreview({
        addons: [addonMsw()]
      })"
    `)
  })

  it('reports csfNext so the CLI can tailor its guidance', () => {
    const csf3 = transformPreview(`export default { parameters: {} }`)
    expect(csf3.csfNext).toBe(false)

    const csfNext = transformPreview(
      dedent`
        import { definePreview } from '@storybook/react-vite'
        export default definePreview({})
      `
    )
    expect(csfNext.csfNext).toBe(true)
  })

  it('moves a loader-carried setup function onto addonMsw(setup)', () => {
    const src = dedent`
      import { definePreview } from '@storybook/react-vite'
      import { setupWorker } from 'msw/browser'
      import { mswLoader } from 'msw-storybook-addon/csf3'

      export default definePreview({
        loaders: [mswLoader(async () => {
          const worker = setupWorker()
          await worker.start({ onUnhandledRequest: 'bypass' })
          return worker
        })],
      })
    `
    const result = transformPreview(src)
    expect(result.warnings).toEqual([])
    expect(result.code).toMatchInlineSnapshot(`
      "import addonMsw from "msw-storybook-addon";
      import { definePreview } from '@storybook/react-vite'
      import { setupWorker } from 'msw/browser'

      export default definePreview({
        addons: [addonMsw(async () => {
          const worker = setupWorker()
          await worker.start({ onUnhandledRequest: 'bypass' })
          return worker
        })],
      })"
    `)
  })

  it('cleans up the state left by `storybook automigrate csf-factories`', () => {
    // The automigration injects a namespace import of the addon's /preview
    // entry (a runtime no-op in v3) and keeps the old loader wiring.
    const src = dedent`
      import * as mswStorybookAddon from 'msw-storybook-addon/preview'
      import { definePreview } from '@storybook/react-vite'
      import { mswLoader } from 'msw-storybook-addon/csf3'

      export default definePreview({
        addons: [mswStorybookAddon],
        loaders: [mswLoader()],
      })
    `
    const result = transformPreview(src)
    expect(result.warnings).toEqual([])
    expect(result.code).toMatchInlineSnapshot(`
      "import addonMsw from "msw-storybook-addon";
      import { definePreview } from '@storybook/react-vite'

      export default definePreview({
        addons: [addonMsw()]
      })"
    `)
  })

  it('replaces an injected namespace entry even without leftover loader wiring', () => {
    const src = dedent`
      import * as mswStorybookAddon from 'msw-storybook-addon/preview'
      import { definePreview } from '@storybook/react-vite'

      export default definePreview({
        addons: [mswStorybookAddon],
      })
    `
    const result = transformPreview(src)
    expect(result.warnings).toEqual([])
    expect(result.code).toMatchInlineSnapshot(`
      "import addonMsw from "msw-storybook-addon";
      import { definePreview } from '@storybook/react-vite'

      export default definePreview({
        addons: [addonMsw()],
      })"
    `)
  })

  it('carries the loader setup when cleaning up the post-automigration state', () => {
    const src = dedent`
      import * as mswStorybookAddon from 'msw-storybook-addon/preview'
      import { definePreview } from '@storybook/react-vite'
      import { setupWorker } from 'msw/browser'
      import { mswLoader } from 'msw-storybook-addon/csf3'

      export default definePreview({
        addons: [mswStorybookAddon],
        loaders: [mswLoader(async () => {
          const worker = setupWorker()
          await worker.start({ quiet: true })
          return worker
        })],
      })
    `
    const result = transformPreview(src)
    expect(result.warnings).toEqual([])
    expect(result.code).toMatchInlineSnapshot(`
      "import addonMsw from "msw-storybook-addon";
      import { definePreview } from '@storybook/react-vite'
      import { setupWorker } from 'msw/browser'

      export default definePreview({
        addons: [addonMsw(async () => {
          const worker = setupWorker()
          await worker.start({ quiet: true })
          return worker
        })]
      })"
    `)
  })

  it('skips and warns when both initialize options and a loader setup exist', () => {
    const src = dedent`
      import { definePreview } from '@storybook/react-vite'
      import { initialize } from 'msw-storybook-addon'
      import { mswLoader } from 'msw-storybook-addon/csf3'

      initialize({ quiet: true })

      export default definePreview({
        loaders: [mswLoader(async () => myWorker)],
      })
    `
    const result = transformPreview(src)
    expect(result.code).toBeNull()
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('merge them into one')
  })

  it('treats a variable-declared definePreview as CSF Next', () => {
    const src = dedent`
      import { definePreview } from '@storybook/react-vite'
      import { initialize, mswLoader } from 'msw-storybook-addon'

      initialize()

      const preview = definePreview({
        loaders: [mswLoader],
      })

      export default preview
    `
    const result = transformPreview(src)
    expect(result.warnings).toEqual([])
    expect(result.code).toMatchInlineSnapshot(`
      "import { definePreview } from '@storybook/react-vite'
      import addonMsw from 'msw-storybook-addon';

      const preview = definePreview({
        addons: [addonMsw()],
      })

      export default preview"
    `)
  })

  it('migrates full v2 wiring inside definePreview to addonMsw(setup)', () => {
    const src = dedent`
      import { definePreview } from '@storybook/react-vite'
      import { initialize, mswLoader } from 'msw-storybook-addon'

      initialize({ onUnhandledRequest: 'bypass' })

      export default definePreview({
        loaders: [mswLoader],
        parameters: {},
      })
    `
    const result = transformPreview(src)
    expect(result.warnings).toEqual([])
    expect(result.code).toMatchInlineSnapshot(`
      "import { setupWorker } from "msw/browser";
      import { definePreview } from '@storybook/react-vite'
      import addonMsw from 'msw-storybook-addon';

      export default definePreview({
        addons: [addonMsw(async () => {
          const worker = setupWorker();
          await worker.start({ onUnhandledRequest: 'bypass' });
          return worker;
        })],
        parameters: {},
      })"
    `)
  })

  it('folds a bare initialize() into a plain addonMsw() registration', () => {
    const src = dedent`
      import { definePreview } from '@storybook/react-vite'
      import { initialize } from 'msw-storybook-addon'

      initialize()

      export default definePreview({
        parameters: {},
      })
    `
    const result = transformPreview(src)
    expect(result.warnings).toEqual([])
    expect(result.code).toMatchInlineSnapshot(`
      "import { definePreview } from '@storybook/react-vite'
      import addonMsw from 'msw-storybook-addon';

      export default definePreview({
        addons: [addonMsw()],
        parameters: {}
      })"
    `)
  })

  it('skips and warns when addonMsw already has a setup function to preserve', () => {
    const src = dedent`
      import { definePreview } from '@storybook/react-vite'
      import addonMsw from 'msw-storybook-addon'
      import { initialize } from 'msw-storybook-addon'

      initialize({ quiet: true })

      export default definePreview({
        addons: [addonMsw(async () => myWorker)],
      })
    `
    const result = transformPreview(src)
    expect(result.code).toBeNull()
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('setup function')
  })

  it('migrates parameters.msw inside definePreview when opted in', () => {
    const src = dedent`
      import { definePreview } from '@storybook/react-vite'
      import addonMsw from 'msw-storybook-addon'
      import { http, HttpResponse } from 'msw'

      export default definePreview({
        addons: [addonMsw()],
        parameters: {
          msw: [http.get('/user', () => HttpResponse.json({}))],
        },
      })
    `
    const result = transformPreview(src, { migrateParameters: true })
    expect(result.warnings).toEqual([])
    expect(result.code).toMatchInlineSnapshot(`
      "import { definePreview } from '@storybook/react-vite'
      import addonMsw from 'msw-storybook-addon'
      import { http, HttpResponse } from 'msw'

      export default definePreview({
        addons: [addonMsw()],

        beforeEach({ msw }) {
          msw.use(http.get('/user', () => HttpResponse.json({})))
        }
      })"
    `)
  })
})
