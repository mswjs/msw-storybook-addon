import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// The codemod edits files through Storybook 11's csf-tools. The Storybook
// installed for these tests may still ship Babel, so a Storybook 10-only API
// or an own parser could creep back in without the other tests noticing;
// this test does notice.
const FORBIDDEN = [
  'storybook/internal/babel',
  '@babel/',
  'recast',
  'babelParse',
  '._ast',
  '_metaPath',
  'getFieldValue',
  'getSafeFieldValue',
  'setFieldValue',
  'setFieldNode'
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
  )('%s uses only Storybook 11 csf-tools', (_, file) => {
    const source = readFileSync(file, 'utf-8')
    expect(FORBIDDEN.filter((pattern) => source.includes(pattern))).toEqual([])
  })
})
