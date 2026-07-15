#!/usr/bin/env node
// CLI entry — `npx msw-storybook-migrate` (shipped as a bin of the
// `msw-storybook-addon` package, so it resolves from the local install).
//
// Migrates a v2 setup to v3:
//   - `.storybook/preview.*`: `mswLoader` → `mswLoader()` (from the /csf3
//     subpath), `mswDecorator` → loader, `initialize(...)` folded into a
//     setup function. CSF Next (`definePreview`) files get `addonMsw()`.
//   - `.storybook/main.*`: registers `'msw-storybook-addon'` in `addons`.
//   - Opt-in (prompted, or `--parameters` / `--no-parameters`): migrates
//     `parameters.msw` to `beforeEach({ msw })` in stories and preview.

import { promises as fs } from 'node:fs'
import { existsSync } from 'node:fs'
import os from 'node:os'
import { join, relative, resolve, sep } from 'node:path'
import readline from 'node:readline/promises'

import { formatFileContent, globToRegexp } from 'storybook/internal/common'
import { logger } from 'storybook/internal/node-logger'

import { transformStory } from './transforms/stories'
import { transformPreview } from './transforms/preview'
import { transformMain } from './transforms/main'

const DEFAULT_GLOB = '**/*.{stories,story}.{js,jsx,ts,tsx,mjs,mjsx,mts,mtsx}'

interface Args {
  glob: string
  preview: string | null
  main: string | null
  configDir: string
  dryRun: boolean
  /** null = undecided (prompt when interactive, default no otherwise). */
  parameters: boolean | null
}

export function parseArgs(argv: string[]): Args {
  const out: Args = {
    glob: DEFAULT_GLOB,
    preview: null,
    main: null,
    configDir: '.storybook',
    dryRun: false,
    parameters: null,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') out.dryRun = true
    else if (a === '--parameters') out.parameters = true
    else if (a === '--no-parameters') out.parameters = false
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

  --parameters         Also migrate \`parameters.msw\` to \`beforeEach({ msw })\`
                       in stories and preview (skips the prompt).
  --no-parameters      Keep \`parameters.msw\` as-is (skips the prompt).
  --glob <pattern>     Story-file glob (used with --parameters). Default:
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

async function confirmParametersMigration(): Promise<boolean> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return false
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = await rl.question(
      '`parameters.msw` keeps working in v3 (CSF 3.0 only) but is deprecated.\n' +
        'Also migrate `parameters.msw` to `beforeEach({ msw })` in your stories and preview? [y/N] ',
    )
    return /^y(es)?$/i.test(answer.trim())
  } finally {
    rl.close()
  }
}

const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'storybook-static',
  '.git',
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
      }),
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

  const previewPath = args.preview
    ? resolve(cwd, args.preview)
    : findConfigFile(configDir, 'preview')
  const mainPath = args.main ? resolve(cwd, args.main) : findConfigFile(configDir, 'main')

  const migrateParameters = args.parameters ?? (await confirmParametersMigration())

  let modified = 0
  let unmodified = 0
  let errors = 0
  const warnings: string[] = []

  // -- Preview
  if (previewPath && existsSync(previewPath)) {
    try {
      const source = await fs.readFile(previewPath, 'utf-8')
      const result = transformPreview(source, { migrateParameters })
      for (const w of result.warnings) warnings.push(`  ${short(previewPath)}: ${w}`)
      if (result.code != null && result.code !== source) {
        if (!args.dryRun) {
          await fs.writeFile(previewPath, await formatFileContent(previewPath, result.code), 'utf-8')
        }
        modified++
        logger.log(`  ✓ ${short(previewPath)}`)
      } else {
        unmodified++
      }
    } catch (err) {
      errors++
      logger.error(`  ✗ ${short(previewPath)}: ${String(err)}`)
    }
  } else {
    logger.warn(
      `Preview file not found${args.preview ? `: ${args.preview}` : ` in ${short(configDir)}`}.`,
    )
  }

  // -- Main
  if (mainPath && existsSync(mainPath)) {
    try {
      const source = await fs.readFile(mainPath, 'utf-8')
      const out = transformMain(source)
      if (out != null && out !== source) {
        if (!args.dryRun) {
          await fs.writeFile(mainPath, await formatFileContent(mainPath, out), 'utf-8')
        }
        modified++
        logger.log(`  ✓ ${short(mainPath)}`)
      } else {
        unmodified++
      }
    } catch (err) {
      errors++
      logger.error(`  ✗ ${short(mainPath)}: ${String(err)}`)
    }
  } else {
    logger.warn(
      `Main config not found${args.main ? `: ${args.main}` : ` in ${short(configDir)}`}.`,
    )
  }

  // -- Stories (opt-in)
  if (migrateParameters) {
    const limit = createLimiter(Math.max(1, os.cpus().length - 1))

    const storyFiles = await findStoryFiles(cwd, args.glob)

    if (storyFiles.length === 0) {
      logger.warn(`No story files matched glob "${args.glob}".`)
    }

    await Promise.all(
      storyFiles.map((file: string) =>
        limit(async () => {
          try {
            const source = await fs.readFile(file, 'utf-8')
            const result = transformStory(source)
            if (result.skippedStories.length > 0) {
              warnings.push(
                `  ${short(file)}: ${result.skippedStories.join(', ')} — \`parameters.msw\` shape not recognised; hand-migrate.`,
              )
            }
            if (result.code != null && result.code !== source) {
              if (!args.dryRun) {
                await fs.writeFile(file, await formatFileContent(file, result.code), 'utf-8')
              }
              modified++
              logger.log(`  ✓ ${short(file)}`)
            } else {
              unmodified++
            }
          } catch (err) {
            errors++
            logger.error(`  ✗ ${short(file)}: ${String(err)}`)
          }
        }),
      ),
    )
  }

  logger.log('')
  logger.log(
    `Summary: ${modified} transformed, ${unmodified} unmodified, ${errors} error(s)`,
  )

  if (warnings.length > 0) {
    logger.log('')
    logger.warn(`${warnings.length} thing(s) the codemod could not migrate:`)
    for (const w of warnings) logger.log(w)
    logger.log('  See MIGRATION.md in the msw-storybook-addon repository for hand-migration steps.')
  }

  logger.log('')
  logger.log(
    'When you are ready to migrate to CSF Next entirely, run `npx storybook automigrate csf-factories` — the msw addon will be wired up automatically.',
  )

  if (args.dryRun) {
    logger.log('')
    logger.log('Dry run — re-run without --dry-run to apply.')
  }

  process.exit(errors > 0 ? 1 : 0)
}

function short(p: string): string {
  const cwd = process.cwd()
  return p.startsWith(cwd) ? p.slice(cwd.length + 1) : p
}

main().catch((err) => {
  logger.error(String((err as Error)?.stack ?? err))
  process.exit(1)
})
