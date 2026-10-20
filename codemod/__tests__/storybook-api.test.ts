import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// The codemod parses and prints with its own Babel and recast, so it works
// on Storybook 10 (Babel ASTs) and Storybook 11 (ESTree ASTs, no
// `storybook/internal/babel`). The Storybook installed for these tests
// still ships Babel, so it would not catch a regression; this test does.
const FORBIDDEN = [
  'storybook/internal/babel',
  '._ast',
  '_metaPath',
  'printCsf',
  'printConfig',
  'loadConfig'
]

const srcDir = join(__dirname, '../src')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? sourceFiles(join(dir, entry.name))
      : entry.name.endsWith('.ts')
        ? [join(dir, entry.name)]
        : []
  )
}

describe('Storybook API usage', () => {
  it.each(
    sourceFiles(srcDir).map((file) => [file.slice(srcDir.length + 1), file])
  )('%s uses no Storybook 10-only API', (_, file) => {
    const source = readFileSync(file, 'utf-8')
    expect(FORBIDDEN.filter((pattern) => source.includes(pattern))).toEqual([])
  })
})
