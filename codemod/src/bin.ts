#!/usr/bin/env node
// CLI entry — `npx msw-storybook-migrate` (shipped as a bin of the
// `msw-storybook-addon` package, so it resolves from the local install).
//
// Migrates a v2 setup to v3:
//   - `.storybook/preview.*`: `mswLoader` → `mswLoader()` (from the /csf3
//     subpath), `mswDecorator` → loader, `initialize(...)` folded into a
//     setup function. CSF Next (`definePreview`) files get `addonMsw()`.
//   - `.storybook/main.*`: registers `'msw-storybook-addon'` in `addons`.
//   - story files: migrates `parameters.msw` to `beforeEach({ msw })`.

import { promises as fs } from 'node:fs'
import { existsSync } from 'node:fs'
import os from 'node:os'
import { join, relative, resolve, sep } from 'node:path'

import { formatFileContent, globToRegexp } from 'storybook/internal/common'
import { CLI_COLORS, logger } from 'storybook/internal/node-logger'
import { dedent } from 'ts-dedent'

import { transformStory } from './transforms/stories'
import { transformPreview } from './transforms/preview'
import { transformMain } from './transforms/main'

const DEFAULT_GLOB = '**/*.{stories,story}.{js,jsx,ts,tsx,mjs,mjsx,mts,mtsx}'
const MIGRATION_URL =
  'https://github.com/mswjs/msw-storybook-addon/blob/main/MIGRATION.md#from-2xx-to-3xx'

interface Args {
  glob: string
  preview: string | null
  main: string | null
  configDir: string
  dryRun: boolean
}

export function parseArgs(argv: string[]): Args {
  const out: Args = {
    glob: DEFAULT_GLOB,
    preview: null,
    main: null,
    configDir: '.storybook',
    dryRun: false
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') out.dryRun = true
    else if (a === '--glob') out.glob = argv[++i] ?? out.glob
    else if (a === '--preview') out.preview = argv[++i] ?? null
    else if (a === '--main') out.main = argv[++i] ?? null
    else if (a === '--config-dir') out.configDir = argv[++i] ?? out.configDir
    else if (a === '--help' || a === '-h') {
      printUsage()
      process.exit(0)
    }
  }
  return out
}

function printUsage(): void {
  // eslint-disable-next-line no-console
  console.log(`msw-storybook-migrate — migrate an msw-storybook-addon v2 setup to v3

Usage: npx msw-storybook-migrate [options]

  --glob <pattern>     Story-file glob. Default:
                       ${DEFAULT_GLOB}
  --preview <path>     Path to preview file. Auto-detected from --config-dir.
  --main <path>        Path to main config. Auto-detected from --config-dir.
  --config-dir <dir>   Storybook config directory. Default: .storybook
  --dry-run            Don't write files; report what would change.
  -h, --help           Show this help.
`)
}

function findConfigFile(configDir: string, basename: string): string | null {
  for (const ext of ['ts', 'tsx', 'mts', 'cts', 'js', 'jsx', 'mjs', 'cjs']) {
    const p = join(configDir, `${basename}.${ext}`)
    if (existsSync(p)) return p
  }
  return null
}

const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'storybook-static',
  '.git'
])

/** Recursive story-file finder — `globToRegexp` from storybook internals
 *  plus a directory walk, so the CLI needs no glob dependency of its own. */
async function findStoryFiles(cwd: string, glob: string): Promise<string[]> {
  const pattern = globToRegexp(glob.replace(/\\/g, '/'))
  const out: string[] = []

  async function walk(dir: string): Promise<void> {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    await Promise.all(
      entries.map(async (entry) => {
        const abs = join(dir, entry.name)
        if (entry.isDirectory()) {
          if (!IGNORED_DIRS.has(entry.name)) await walk(abs)
        } else if (entry.isFile()) {
          const rel = relative(cwd, abs).split(sep).join('/')
          if (pattern.test(rel)) out.push(abs)
        }
      })
    )
  }

  await walk(cwd)
  return out.sort()
}

/** Tiny concurrency limiter — avoids a p-limit dependency. */
function createLimiter(concurrency: number) {
  let active = 0
  const queue: (() => void)[] = []
  const next = () => {
    active--
    queue.shift()?.()
  }
  return async function limit<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= concurrency) {
      await new Promise<void>((resolveWait) => queue.push(resolveWait))
    }
    active++
    try {
      return await fn()
    } finally {
      next()
    }
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const cwd = process.cwd()
  const configDir = resolve(cwd, args.configDir)

  logger.intro(
    `msw-storybook-addon migration${args.dryRun ? ' (dry run)' : ''}`
  )

  const previewPath = args.preview
    ? resolve(cwd, args.preview)
    : findConfigFile(configDir, 'preview')
  const mainPath = args.main
    ? resolve(cwd, args.main)
    : findConfigFile(configDir, 'main')

  const transformed: string[] = []
  const failed: string[] = []
  let unmodified = 0
  const warnings: string[] = []
  // Stories skipped by the story transform, grouped per reason so the final
  // report explains each group once instead of repeating itself per file.
  const unrecognizedShape: string[] = []
  const existingBeforeEach: string[] = []

  let previewIsCsfNext: boolean | undefined

  const check = CLI_COLORS.success('✔')
  // Flush the files transformed since the last phase as one block.
  let flushedCount = 0
  const flushPhase = () => {
    const phaseFiles = transformed.slice(flushedCount).sort()
    flushedCount = transformed.length
    if (phaseFiles.length > 0) {
      logger.log(phaseFiles.map((file) => `${check} ${file}`).join('\n'))
    }
  }

  // -- Preview + main config
  logger.step('Migrating your Storybook configuration...')

  if (previewPath && existsSync(previewPath)) {
    try {
      const source = await fs.readFile(previewPath, 'utf-8')
      const result = transformPreview(source, { migrateParameters: true })
      previewIsCsfNext = result.csfNext
      for (const w of result.warnings)
        warnings.push(`${short(previewPath)}: ${w}`)
      if (result.code != null && result.code !== source) {
        if (!args.dryRun) {
          await fs.writeFile(
            previewPath,
            await formatFileContent(previewPath, result.code),
            'utf-8'
          )
        }
        transformed.push(short(previewPath))
      } else {
        unmodified++
      }
    } catch (err) {
      failed.push(`${short(previewPath)}: ${String(err)}`)
    }
  } else {
    warnings.push(
      `Preview file not found${args.preview ? `: ${args.preview}` : ` in ${short(configDir)}`}.`
    )
  }

  if (mainPath && existsSync(mainPath)) {
    try {
      const source = await fs.readFile(mainPath, 'utf-8')
      const out = transformMain(source)
      if (out != null && out !== source) {
        if (!args.dryRun) {
          await fs.writeFile(
            mainPath,
            await formatFileContent(mainPath, out),
            'utf-8'
          )
        }
        transformed.push(short(mainPath))
      } else {
        unmodified++
      }
    } catch (err) {
      failed.push(`${short(mainPath)}: ${String(err)}`)
    }
  } else {
    warnings.push(
      `Main config not found${args.main ? `: ${args.main}` : ` in ${short(configDir)}`}.`
    )
  }

  flushPhase()

  // -- Stories
  logger.step('Migrating `parameters.msw` in your story files...')
  const limit = createLimiter(Math.max(1, os.cpus().length - 1))

  const storyFiles = await findStoryFiles(cwd, args.glob)

  if (storyFiles.length === 0) {
    warnings.push(`No story files matched glob "${args.glob}".`)
  }

  await Promise.all(
    storyFiles.map((file: string) =>
      limit(async () => {
        try {
          const source = await fs.readFile(file, 'utf-8')
          const result = transformStory(source)
          const shapes = result.skippedStories
            .filter((s) => s.reason === 'unrecognized-shape')
            .map((s) => s.story)
          const merges = result.skippedStories
            .filter((s) => s.reason === 'existing-before-each')
            .map((s) => s.story)
          if (shapes.length > 0) {
            unrecognizedShape.push(`${short(file)}: ${shapes.join(', ')}`)
          }
          if (merges.length > 0) {
            existingBeforeEach.push(`${short(file)}: ${merges.join(', ')}`)
          }
          if (result.code != null && result.code !== source) {
            if (!args.dryRun) {
              await fs.writeFile(
                file,
                await formatFileContent(file, result.code),
                'utf-8'
              )
            }
            transformed.push(short(file))
          } else {
            unmodified++
          }
        } catch (err) {
          failed.push(`${short(file)}: ${String(err)}`)
        }
      })
    )
  )

  flushPhase()

  logger.log(
    CLI_COLORS.muted(
      `${transformed.length} file(s) ${args.dryRun ? 'would be ' : ''}updated, ${unmodified} already up to date`
    )
  )

  if (failed.length > 0) {
    logger.error(failed.join('\n'))
  }

  const skippedAnything =
    warnings.length > 0 ||
    unrecognizedShape.length > 0 ||
    existingBeforeEach.length > 0
  if (skippedAnything) {
    const sections: string[] = []
    if (warnings.length > 0) {
      sections.push(warnings.map((w) => `• ${w}`).join('\n'))
    }
    if (unrecognizedShape.length > 0) {
      sections.push(
        `Could not recognize the \`parameters.msw\` shape — migrate them manually:\n${unrecognizedShape
          .map((w) => `  • ${w}`)
          .join('\n')}`
      )
    }
    if (existingBeforeEach.length > 0) {
      sections.push(
        `\`beforeEach\` already defined — migrate \`parameters.msw\` manually:\n${existingBeforeEach
          .map((w) => `  • ${w}`)
          .join('\n')}`
      )
    }
    sections.push(
      "Don't worry — the addon still supports `parameters.msw`, so everything keeps working until you migrate."
    )
    sections.push(`See the migration guide:\n${CLI_COLORS.cta(MIGRATION_URL)}`)
    logger.warn(
      `The codemod could not migrate everything:\n${sections.join('\n\n')}`
    )
  }

  if (previewIsCsfNext === false) {
    logger.logBox(
      dedent`
        All set, happy mocking!

        v3 of this addon was designed to work best with CSF Next, which you can migrate to with this command:
        ${CLI_COLORS.cta('npx storybook automigrate csf-factories')}

        To learn more about CSF Next, see the Storybook docs:
        ${CLI_COLORS.cta('https://storybook.js.org/docs/api/csf/csf-next')}
      `
    )
  } else if (previewIsCsfNext === true) {
    logger.logBox(
      dedent`
        All set. Happy mocking!
      `
    )
  } else {
    logger.logBox(
      dedent`
        v3 of this addon was designed to work best with CSF Next, which you can migrate to with this command:
        ${CLI_COLORS.cta('npx storybook automigrate csf-factories')}

        To learn more about CSF Next, see the Storybook docs:
        ${CLI_COLORS.cta('https://storybook.js.org/docs/api/csf/csf-next')}
      `
    )
  }

  if (args.dryRun) {
    logger.outro(
      'Dry run — nothing was written. Re-run without --dry-run to apply.'
    )
  } else {
    logger.outro(failed.length > 0 ? 'Finished with errors.' : 'Done!')
  }

  process.exit(failed.length > 0 ? 1 : 0)
}

function short(p: string): string {
  const cwd = process.cwd()
  return p.startsWith(cwd) ? p.slice(cwd.length + 1) : p
}

main().catch((err) => {
  logger.error(String((err as Error)?.stack ?? err))
  process.exit(1)
})
