import { describe } from 'vitest'

/**
 * The codemod has one implementation per csf-tools generation: Babel for
 * Storybook 9 and 10, ESTree for Storybook 11. Like the CLI, the tests pick
 * by whether the installed csf-tools has `parseModule`. Each suite runs on
 * the Storybook it is written for, and is skipped with the reason otherwise.
 */
interface CsfToolsSuite {
  describe: (name: string, fn: () => void) => void
  /** Imports a transform, which cannot even load on the other Storybook. */
  load: <T>(load: () => Promise<T>) => Promise<T>
}

function suite(available: boolean, needs: string): CsfToolsSuite {
  return {
    describe: (name, fn) =>
      available
        ? describe(name, fn)
        : describe.skip(`${name} (needs ${needs})`, fn),
    load: (load) => (available ? load() : Promise.resolve({} as never))
  }
}

const hasEstree =
  'parseModule' in (await import('storybook/internal/csf-tools'))

export const babel = suite(
  !hasEstree,
  'the Babel csf-tools of Storybook 9 or 10'
)
export const estree = suite(hasEstree, 'the ESTree csf-tools of Storybook 11')
