import type { TestProject } from 'vitest/node'

export type Transforms = 'babel' | 'estree'

declare module 'vitest' {
  export interface ProvidedContext {
    transforms: Transforms
  }
}

/**
 * Picks the transforms to test the way the CLI does: by whether the
 * installed csf-tools has `parseModule`.
 */
export default async function setup(project: TestProject) {
  const csfTools = await import('storybook/internal/csf-tools')
  const transforms: Transforms = 'parseModule' in csfTools ? 'estree' : 'babel'
  project.provide('transforms', transforms)
  console.info(
    transforms === 'estree'
      ? 'Testing the ESTree transforms. The Babel ones are skipped: they need Storybook 9 or 10.'
      : 'Testing the Babel transforms. The ESTree ones are skipped: they need the csf-tools of Storybook 11 (storybookjs/storybook#36613).'
  )
}
