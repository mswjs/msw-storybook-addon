#!/usr/bin/env node
// CLI entry — `npx msw-storybook-migrate`.
//
// Walks the project for story files and the project's `.storybook/main.*`
// and `preview.*` files, runs the three transforms, writes back.
//
// Args:
//   --glob <pat>       Story-file glob.
//                      Default: **/*.{stories,story}.{js,jsx,ts,tsx,mjs,mjsx,mts,mtsx}
//   --preview <path>   Preview file. Auto-detected from .storybook/preview.*.
//   --main <path>      Main config. Auto-detected from .storybook/main.*.
//   --config-dir <d>   Storybook config directory. Default: .storybook.
//   --dry-run          Don't write files; print what would change.

import { promises as fs } from 'node:fs'
import { existsSync } from 'node:fs'
import os from 'node:os'
import { join, resolve } from 'node:path'

import { logger } from 'storybook/internal/node-logger'
import picocolors from 'picocolors'

import { transformStory } from './transforms/stories'
import { transformPreview } from './transforms/preview'
import { transformMain } from './transforms/main'

interface Args {
  glob: string
  preview: string | null
  main: string | null
  configDir: string
  dryRun: boolean
}

function parseArgs(argv: string[]): Args {
  const out: Args = {
    glob: '**/*.{stories,story}.{js,jsx,ts,tsx,mjs,mjsx,mts,mtsx}',
    preview: null,
    main: null,
    configDir: '.storybook',
    dryRun: false,
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
  console.log(`msw-storybook-migrate — migrate stories + preview.ts to the new API

Usage: npx msw-storybook-migrate [options]

  --glob <pattern>     Story-file glob. Default:
                       **/*.{stories,story}.{js,jsx,ts,tsx,mjs,mjsx,mts,mtsx}
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

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const cwd = process.cwd()
  const configDir = resolve(cwd, args.configDir)

  const previewPath = args.preview
    ? resolve(cwd, args.preview)
    : findConfigFile(configDir, 'preview')
  const mainPath = args.main
    ? resolve(cwd, args.main)
    : findConfigFile(configDir, 'main')

  let modified = 0
  let unmodified = 0
  let errors = 0
  const warnings: string[] = []

  // -- Stories
  const { globby } = await import('globby')
  // eslint-disable-next-line depend/ban-dependencies
  const slash = (await import('slash')).default
  const pLimit = (await import('p-limit')).default
  const concurrency = Math.max(1, os.cpus().length - 1)
  const limit = pLimit(concurrency)

  const storyFiles = await globby(slash(args.glob), {
    cwd,
    followSymbolicLinks: true,
    ignore: ['**/node_modules/**', '**/dist/**', '**/storybook-static/**', '**/build/**'],
    absolute: true,
  })

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
              `  ${picocolors.yellow(short(file))}: ${result.skippedStories.join(', ')} ` +
                `— parameters.msw shape not recognised; hand-migrate.`,
            )
          }
          if (result.code != null && result.code !== source) {
            if (!args.dryRun) await fs.writeFile(file, result.code, 'utf-8')
            modified++
            logger.log(picocolors.green(`  ✓ ${short(file)}`))
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

  // -- Preview
  if (previewPath && existsSync(previewPath)) {
    try {
      const source = await fs.readFile(previewPath, 'utf-8')
      const out = transformPreview(source)
      if (out != null && out !== source) {
        if (!args.dryRun) await fs.writeFile(previewPath, out, 'utf-8')
        modified++
        logger.log(picocolors.green(`  ✓ ${short(previewPath)}`))
      } else {
        unmodified++
      }
    } catch (err) {
      errors++
      logger.error(`  ✗ ${short(previewPath)}: ${String(err)}`)
    }
  } else if (args.preview) {
    logger.warn(`Preview file not found: ${args.preview}`)
  }

  // -- Main
  if (mainPath && existsSync(mainPath)) {
    try {
      const source = await fs.readFile(mainPath, 'utf-8')
      const out = transformMain(source)
      if (out != null && out !== source) {
        if (!args.dryRun) await fs.writeFile(mainPath, out, 'utf-8')
        modified++
        logger.log(picocolors.green(`  ✓ ${short(mainPath)}`))
      } else {
        unmodified++
      }
    } catch (err) {
      errors++
      logger.error(`  ✗ ${short(mainPath)}: ${String(err)}`)
    }
  } else if (args.main) {
    logger.warn(`Main config file not found: ${args.main}`)
  }

  logger.log('')
  logger.log(
    `Summary: ${picocolors.green(`${modified} transformed`)}, ` +
      `${picocolors.dim(`${unmodified} unmodified`)}, ` +
      `${errors > 0 ? picocolors.red(`${errors} errors`) : '0 errors'}`,
  )

  if (warnings.length > 0) {
    logger.log('')
    logger.warn(`${warnings.length} file(s) had stories the codemod could not migrate:`)
    for (const w of warnings) logger.log(w)
    logger.log(
      `\n  These usually use a custom-shaped \`parameters.msw\` value. ` +
        `See the migration guide in the addon's README for hand-migration steps.`,
    )
  }

  if (args.dryRun) {
    logger.log('')
    logger.log(picocolors.bold(`Dry run — re-run without --dry-run to apply.`))
  }

  process.exit(errors > 0 ? 1 : 0)
}

function short(p: string): string {
  const cwd = process.cwd()
  return p.startsWith(cwd) ? p.slice(cwd.length + 1) : p
}

main().catch((err) => {
  logger.error(String(err?.stack ?? err))
  process.exit(1)
})
