import { defineConfig } from 'vitest/config'

// Each fixture compiles its type tests against its own `tsconfig.json`, which
// is what makes them meaningful: they differ in how the addon's types are
// brought in.
const typecheckFixtures = ['factory', 'csf3', 'types-entry']

export default defineConfig({
  test: {
    projects: typecheckFixtures.map((fixture) => ({
      test: {
        name: fixture,
        typecheck: {
          enabled: true,
          only: true,
          include: [`tests/${fixture}/**/*.test-d.ts`],
          tsconfig: `./tests/${fixture}/tsconfig.json`
        }
      }
    }))
  }
})
