import { describe, inject } from 'vitest'
import type { Transforms } from './global-setup'

/**
 * The codemod has one implementation per csf-tools generation: Babel for
 * Storybook 9 and 10, ESTree for Storybook 11. Each suite runs on the
 * Storybook it is written for, and is skipped with the reason otherwise.
 */
interface CsfToolsSuite {
  describe: (name: string, fn: () => void) => void
  /** Imports a transform, which cannot even load on the other Storybook. */
  load: <T>(load: () => Promise<T>) => Promise<T>
}

function suite(transforms: Transforms, needs: string): CsfToolsSuite {
  const available = inject('transforms') === transforms
  return {
    describe: (name, fn) =>
      available
        ? describe(name, fn)
        : describe.skip(`${name} (needs ${needs})`, fn),
    load: (load) => (available ? load() : Promise.resolve({} as never))
  }
}

export const babel = suite('babel', 'the Babel csf-tools of Storybook 9 or 10')
export const estree = suite('estree', 'the ESTree csf-tools of Storybook 11')
