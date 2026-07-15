/**
 * `.storybook/preview.{js,ts,jsx,tsx}` transform.
 *
 * Migrates a v2 preview to the v3 wiring:
 *
 *   CSF 3.0 (plain-object preview):
 *     - `loaders: [mswLoader]` / `loaders: mswLoader` → `loaders: [mswLoader()]`
 *     - `decorators: [mswDecorator]` → removed; a `mswLoader()` loader is
 *       ensured instead (the 2.x migration documented them as equivalent).
 *     - `initialize()` (bare) → removed.
 *     - `initialize(options[, initialHandlers])` → removed; folded into a
 *       setup function passed to `mswLoader(async () => { ... })`.
 *     - `import { mswLoader } from 'msw-storybook-addon'` → retargeted to
 *       the `msw-storybook-addon/csf3` subpath.
 *
 *   CSF Next (`definePreview({...})`):
 *     - Any leftover v2/v3 wiring (loaders, decorators, `initialize`) is
 *       stripped and `addonMsw()` is ensured in `addons: [...]`, with
 *       `initialize` options folded into `addonMsw(setup)`.
 *     - A file with no msw wiring at all is left untouched.
 *
 *   Opt-in (`migrateParameters`): preview-level `parameters.msw` is
 *   converted into a `beforeEach({ msw })` hook using the same
 *   recognised-shapes-only rules as the story transform.
 *
 * Skip-and-warn (the file is left untouched and a warning is returned):
 *     - `const worker = initialize(...)` — the return value is captured;
 *       v3 has no synchronous worker reference to give back.
 *     - `initialize` referenced anywhere other than a plain top-level call
 *       (conditional calls, re-exports, passing it around).
 *     - More than one `initialize(...)` call.
 *     - `initialize(...args)` spread arguments.
 *     - `initialize` options to fold, but the existing `mswLoader(...)` /
 *       `addonMsw(...)` already carries a setup function.
 *
 * Idempotent: running twice produces the same result and no spurious diff.
 */

import { types as t } from 'storybook/internal/babel'
import {
  type ConfigFile,
  isCsfFactoryPreview,
  loadConfig,
  printConfig
} from 'storybook/internal/csf-tools'
import {
  buildBeforeEachProperty,
  extractHandlers,
  findObjectProperty,
  hasAnyProperty
} from './stories'

const ADDON_PACKAGE = 'msw-storybook-addon'
const CSF3_SUBPATH = 'msw-storybook-addon/csf3'
const PREVIEW_SUBPATH = 'msw-storybook-addon/preview'
const MSW_BROWSER = 'msw/browser'

export interface PreviewTransformOptions {
  /** Also migrate preview-level `parameters.msw` to `beforeEach({ msw })`. */
  migrateParameters?: boolean
}

export interface PreviewTransformResult {
  /** Transformed source, or null when no changes were needed (or the file
   *  was skipped — check `warnings`). */
  code: string | null
  /** Human-readable reasons for anything the codemod refused to migrate. */
  warnings: string[]
  /** Whether the preview uses CSF Next (`definePreview`). Undefined when
   *  the file could not be parsed. The CLI uses this to tailor its
   *  follow-up guidance. */
  csfNext?: boolean
}

interface AddonImports {
  /** Local name of `initialize`, if imported. */
  initialize?: string
  /** Local name of `mswLoader`, if imported (from the root or /csf3). */
  mswLoader?: string
  /** Local name of `mswDecorator`, if imported. */
  mswDecorator?: string
  /** Local name of the default export (`addonMsw`), if imported. */
  addonDefault?: string
  /** Local name of `import * as x from 'msw-storybook-addon/preview'` —
   *  what `storybook automigrate csf-factories` injects into `addons`.
   *  A no-op at runtime in v3, so it gets replaced with `addonMsw()`. */
  previewNamespace?: string
}

interface InitializeFold {
  /** The top-level `initialize(...)` statement to remove. */
  stmt: t.ExpressionStatement
  /** `worker.start()` options — first argument, carried verbatim. */
  options?: t.Expression
  /** Initial handlers — second argument, spread into `setupWorker(...)`. */
  handlers?: t.Expression
}

export function transformPreview(
  source: string,
  options: PreviewTransformOptions = {}
): PreviewTransformResult {
  const warnings: string[] = []
  let parsed: ConfigFile
  try {
    parsed = loadConfig(source).parse()
  } catch {
    return { code: null, warnings }
  }

  const body = parsed._ast.program.body
  const imports = collectAddonImports(body)
  // The parser unwraps call-wrapped and variable-declared default exports,
  // so this covers `export default {}`, `export default definePreview({})`
  // and `const preview = definePreview({}); export default preview`.
  const previewObj = parsed._exportsObject ?? null
  const isFactories = isCsfFactoryPreview(parsed)

  // ---- analyze `initialize` usage (before mutating anything) ----
  let fold: InitializeFold | null = null
  if (imports.initialize) {
    const analyzed = analyzeInitialize(parsed, imports.initialize, warnings)
    if (analyzed === 'skip') {
      return { code: null, warnings, csfNext: isFactories }
    }
    fold = analyzed
  }

  const usesMsw =
    imports.initialize != null ||
    imports.mswLoader != null ||
    imports.mswDecorator != null ||
    imports.addonDefault != null

  if (!previewObj) {
    if (usesMsw) {
      warnings.push(
        'Could not find the preview config object (the default export); hand-migrate this file.'
      )
    }
    return { code: null, warnings, csfNext: isFactories }
  }

  const needsSetup =
    fold != null && (fold.options != null || fold.handlers != null)

  let changed = false

  if (isFactories) {
    // ---- CSF Next -------------------------------------------------------
    // A setup function carried by an existing `mswLoader(setup)` moves onto
    // `addonMsw(setup)`. Collected before stripping the loader.
    const loaderSetup = imports.mswLoader
      ? collectLoaderSetup(previewObj, imports.mswLoader)
      : null
    if (loaderSetup === 'conflict') {
      warnings.push(
        'Multiple `mswLoader(...)` setup functions found; migrate this file by hand.'
      )
      return { code: null, warnings, csfNext: true }
    }
    if (needsSetup && loaderSetup != null) {
      warnings.push(
        'Both `initialize(...)` options and a `mswLoader(...)` setup function exist; merge them into one setup function by hand.'
      )
      return { code: null, warnings, csfNext: true }
    }

    const strippedLoader = imports.mswLoader
      ? stripMswRef(previewObj, 'loaders', imports.mswLoader)
      : false
    const strippedDecorator = imports.mswDecorator
      ? stripMswRef(previewObj, 'decorators', imports.mswDecorator)
      : false
    const hasNamespaceEntry =
      imports.previewNamespace != null &&
      findAddonsEntryIndex(previewObj, imports.previewNamespace) !== -1
    const hasWiring =
      strippedLoader || strippedDecorator || hasNamespaceEntry || fold != null

    if (!hasWiring) {
      if (options.migrateParameters) {
        if (migratePreviewParameters(previewObj, warnings)) changed = true
      }
      return finish(parsed, source, changed, warnings, true)
    }

    // Ensure the addon is registered, folding the setup function in.
    const setupFn = needsSetup
      ? buildSetupFunction(fold as InitializeFold)
      : (loaderSetup as t.Expression | null)
    const addonResult = ensureFactoriesAddon(
      parsed,
      previewObj,
      imports,
      setupFn,
      warnings
    )
    if (addonResult === 'conflict') {
      return { code: null, warnings, csfNext: true }
    }
    changed = true

    if (fold != null) {
      removeStatement(body, fold.stmt)
    }
    removeSpecifiers(parsed, ['initialize', 'mswLoader', 'mswDecorator'])
    if (hasNamespaceEntry) removePreviewNamespaceImport(parsed)
    if (needsSetup) ensureSetupWorkerImport(parsed)
  } else {
    // ---- CSF 3.0 --------------------------------------------------------
    // Only wire the loader when the file actually used the loader path
    // (loader, decorator, or initialize) — a stray default import alone is
    // not enough to justify injecting wiring.
    const usesLoaderPath =
      imports.mswLoader != null || imports.mswDecorator != null || fold != null
    if (!usesLoaderPath) {
      if (options.migrateParameters) {
        if (migratePreviewParameters(previewObj, warnings)) changed = true
      }
      return finish(parsed, source, changed, warnings, false)
    }

    const loaderName = imports.mswLoader ?? 'mswLoader'
    const setupFn = needsSetup
      ? buildSetupFunction(fold as InitializeFold)
      : null

    const loaderResult = ensureLoaderCall(
      previewObj,
      loaderName,
      setupFn,
      imports
    )
    if (loaderResult === 'conflict') {
      warnings.push(
        '`initialize(...)` options could not be folded: the existing `mswLoader(...)` already receives a setup function. Merge them by hand.'
      )
      return { code: null, warnings, csfNext: false }
    }
    if (loaderResult === 'changed') changed = true

    if (imports.mswDecorator) {
      if (stripMswRef(previewObj, 'decorators', imports.mswDecorator))
        changed = true
    }

    if (fold != null) {
      removeStatement(body, fold.stmt)
      changed = true
    }

    if (removeSpecifiers(parsed, ['initialize', 'mswDecorator'])) changed = true
    if (retargetLoaderImport(parsed)) changed = true
    if (ensureLoaderImport(parsed, loaderName)) changed = true
    if (needsSetup) ensureSetupWorkerImport(parsed)
  }

  if (options.migrateParameters) {
    if (migratePreviewParameters(previewObj, warnings)) changed = true
  }

  return finish(parsed, source, changed, warnings, isFactories)
}

function finish(
  parsed: ConfigFile,
  source: string,
  changed: boolean,
  warnings: string[],
  csfNext: boolean
): PreviewTransformResult {
  if (!changed) return { code: null, warnings, csfNext }
  const code = printConfig(parsed).code
  return { code: code === source ? null : code, warnings, csfNext }
}

// -------- imports

function collectAddonImports(body: t.Statement[]): AddonImports {
  const out: AddonImports = {}
  for (const stmt of body) {
    if (!t.isImportDeclaration(stmt)) continue
    const src = stmt.source.value
    if (src === PREVIEW_SUBPATH) {
      for (const spec of stmt.specifiers) {
        if (t.isImportNamespaceSpecifier(spec)) {
          out.previewNamespace = spec.local.name
        }
      }
      continue
    }
    if (src !== ADDON_PACKAGE && src !== CSF3_SUBPATH) continue
    for (const spec of stmt.specifiers) {
      if (t.isImportDefaultSpecifier(spec)) {
        out.addonDefault = spec.local.name
      } else if (t.isImportSpecifier(spec)) {
        const name = importedName(spec)
        if (name === 'initialize') out.initialize = spec.local.name
        if (name === 'mswLoader') out.mswLoader = spec.local.name
        if (name === 'mswDecorator') out.mswDecorator = spec.local.name
      }
    }
  }
  return out
}

function importedName(spec: t.ImportSpecifier): string | null {
  const imported = spec.imported
  return (
    (t.isIdentifier(imported) && imported.name) ||
    (t.isStringLiteral(imported) && imported.value) ||
    null
  )
}

/** Remove the given specifiers from addon imports; drop emptied declarations. */
function removeSpecifiers(parsed: ConfigFile, names: string[]): boolean {
  let changed = false
  const body = parsed._ast.program.body
  for (const stmt of body) {
    if (!t.isImportDeclaration(stmt)) continue
    const src = stmt.source.value
    if (src !== ADDON_PACKAGE && src !== CSF3_SUBPATH) continue
    const before = stmt.specifiers.length
    stmt.specifiers = stmt.specifiers.filter((spec) => {
      if (!t.isImportSpecifier(spec)) return true
      const name = importedName(spec)
      return name == null || !names.includes(name)
    })
    if (stmt.specifiers.length !== before) changed = true
  }
  parsed._ast.program.body = body.filter((stmt) => {
    if (!t.isImportDeclaration(stmt)) return true
    const src = stmt.source.value
    if (src !== ADDON_PACKAGE && src !== CSF3_SUBPATH) return true
    // Preserve genuine side-effect imports (they never had specifiers we
    // could have removed); drop declarations we emptied ourselves.
    return stmt.specifiers.length > 0
  })
  return changed
}

/** Move a root-package `mswLoader` specifier onto the /csf3 subpath. */
function retargetLoaderImport(parsed: ConfigFile): boolean {
  const body = parsed._ast.program.body
  let loaderSpec: t.ImportSpecifier | null = null
  let changed = false

  for (const stmt of body) {
    if (!t.isImportDeclaration(stmt)) continue
    if (stmt.source.value !== ADDON_PACKAGE) continue
    const spec = stmt.specifiers.find(
      (s): s is t.ImportSpecifier =>
        t.isImportSpecifier(s) && importedName(s) === 'mswLoader'
    )
    if (!spec) continue

    const onlySpecifier = stmt.specifiers.length === 1
    if (onlySpecifier) {
      stmt.source = t.stringLiteral(CSF3_SUBPATH)
    } else {
      stmt.specifiers = stmt.specifiers.filter((s) => s !== spec)
      loaderSpec = spec
    }
    changed = true
  }

  if (loaderSpec) {
    mergeIntoCsf3Import(parsed, loaderSpec)
  }
  return changed
}

function mergeIntoCsf3Import(
  parsed: ConfigFile,
  spec: t.ImportSpecifier
): void {
  for (const stmt of parsed._ast.program.body) {
    if (!t.isImportDeclaration(stmt)) continue
    if (stmt.source.value !== CSF3_SUBPATH) continue
    const has = stmt.specifiers.some(
      (s) => t.isImportSpecifier(s) && importedName(s) === importedName(spec)
    )
    if (!has) stmt.specifiers.push(spec)
    return
  }
  parsed._ast.program.body.unshift(
    t.importDeclaration([spec], t.stringLiteral(CSF3_SUBPATH))
  )
}

/** Ensure `import { mswLoader } from 'msw-storybook-addon/csf3'` exists. */
function ensureLoaderImport(parsed: ConfigFile, localName: string): boolean {
  for (const stmt of parsed._ast.program.body) {
    if (!t.isImportDeclaration(stmt)) continue
    if (stmt.source.value !== CSF3_SUBPATH) continue
    const has = stmt.specifiers.some(
      (s) => t.isImportSpecifier(s) && importedName(s) === 'mswLoader'
    )
    if (has) return false
    stmt.specifiers.push(
      t.importSpecifier(t.identifier(localName), t.identifier('mswLoader'))
    )
    return true
  }
  parsed._ast.program.body.unshift(
    t.importDeclaration(
      [t.importSpecifier(t.identifier(localName), t.identifier('mswLoader'))],
      t.stringLiteral(CSF3_SUBPATH)
    )
  )
  return true
}

/** Ensure `import { setupWorker } from 'msw/browser'` exists. */
function ensureSetupWorkerImport(parsed: ConfigFile): void {
  for (const stmt of parsed._ast.program.body) {
    if (!t.isImportDeclaration(stmt)) continue
    if (stmt.source.value !== MSW_BROWSER) continue
    const has = stmt.specifiers.some(
      (s) => t.isImportSpecifier(s) && importedName(s) === 'setupWorker'
    )
    if (!has) {
      stmt.specifiers.push(
        t.importSpecifier(
          t.identifier('setupWorker'),
          t.identifier('setupWorker')
        )
      )
    }
    return
  }
  parsed._ast.program.body.unshift(
    t.importDeclaration(
      [
        t.importSpecifier(
          t.identifier('setupWorker'),
          t.identifier('setupWorker')
        )
      ],
      t.stringLiteral(MSW_BROWSER)
    )
  )
}

// -------- `initialize` analysis

function analyzeInitialize(
  parsed: ConfigFile,
  localName: string,
  warnings: string[]
): InitializeFold | null | 'skip' {
  const body = parsed._ast.program.body
  const calls: { stmt: t.ExpressionStatement; call: t.CallExpression }[] = []
  const knownNodes = new Set<t.Node>()

  for (const stmt of body) {
    if (t.isImportDeclaration(stmt)) {
      knownNodes.add(stmt)
      continue
    }
    if (
      t.isExpressionStatement(stmt) &&
      t.isCallExpression(stmt.expression) &&
      t.isIdentifier(stmt.expression.callee) &&
      stmt.expression.callee.name === localName
    ) {
      calls.push({ stmt, call: stmt.expression })
      knownNodes.add(stmt.expression.callee)
    }
  }

  // Any other reference to `initialize` (captured return value, conditional
  // call, passing the function around) → we can't rewrite faithfully.
  if (
    countIdentifierReferences(parsed._ast.program, localName, knownNodes) > 0
  ) {
    warnings.push(
      `\`${localName}\` is used in a way the codemod cannot rewrite (e.g. its return value is captured, or it is called conditionally). Migrate this file by hand — see the "initialize is removed" section of MIGRATION.md.`
    )
    return 'skip'
  }

  if (calls.length === 0) {
    // Imported but never called — just drop the import.
    return null
  }

  if (calls.length > 1) {
    warnings.push(
      `Multiple \`${localName}(...)\` calls found; migrate this file by hand.`
    )
    return 'skip'
  }

  const { stmt, call } = calls[0]
  const args = call.arguments

  if (args.some((a) => !t.isExpression(a))) {
    warnings.push(
      `\`${localName}(...)\` receives arguments the codemod cannot carry over (e.g. spreads); migrate this file by hand.`
    )
    return 'skip'
  }
  if (args.length > 2) {
    warnings.push(
      `\`${localName}(...)\` receives more than two arguments; migrate this file by hand.`
    )
    return 'skip'
  }

  return {
    stmt,
    options: (args[0] as t.Expression | undefined) ?? undefined,
    handlers: (args[1] as t.Expression | undefined) ?? undefined
  }
}

/** Count `Identifier` references to `name`, ignoring the given nodes and
 *  non-reference positions we can cheaply detect (member properties and
 *  non-computed object keys). Conservative: an unexplained occurrence makes
 *  the caller skip the file. */
function countIdentifierReferences(
  root: t.Node,
  name: string,
  ignore: Set<t.Node>
): number {
  let count = 0
  const seen = new Set<t.Node>()

  function walk(node: t.Node | null | undefined): void {
    if (node == null || typeof node !== 'object' || seen.has(node)) return
    seen.add(node)
    if (ignore.has(node)) return

    if (t.isIdentifier(node) && node.name === name) {
      count++
      return
    }

    for (const key of Object.keys(node)) {
      if (
        key === 'loc' ||
        key === 'leadingComments' ||
        key === 'trailingComments' ||
        key === 'innerComments'
      ) {
        continue
      }
      // Skip non-reference identifier positions.
      if (t.isMemberExpression(node) && key === 'property' && !node.computed)
        continue
      if (
        (t.isObjectProperty(node) || t.isObjectMethod(node)) &&
        key === 'key' &&
        !node.computed
      )
        continue

      const value = (node as unknown as Record<string, unknown>)[key]
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item === 'object' && 'type' in item)
            walk(item as t.Node)
        }
      } else if (value && typeof value === 'object' && 'type' in value) {
        walk(value as t.Node)
      }
    }
  }

  walk(root)
  return count
}

// -------- setup function builder
//
//   async () => {
//     const worker = setupWorker(...initialHandlers)
//     await worker.start(options)
//     return worker
//   }

function buildSetupFunction(fold: InitializeFold): t.ArrowFunctionExpression {
  const setupWorkerArgs: (t.Expression | t.SpreadElement)[] = []
  if (fold.handlers) {
    if (t.isArrayExpression(fold.handlers)) {
      for (const el of fold.handlers.elements) {
        if (el != null)
          setupWorkerArgs.push(el as t.Expression | t.SpreadElement)
      }
    } else {
      setupWorkerArgs.push(t.spreadElement(fold.handlers))
    }
  }

  const startArgs: t.Expression[] = fold.options ? [fold.options] : []

  const bodyStatements: t.Statement[] = [
    t.variableDeclaration('const', [
      t.variableDeclarator(
        t.identifier('worker'),
        t.callExpression(t.identifier('setupWorker'), setupWorkerArgs)
      )
    ]),
    t.expressionStatement(
      t.awaitExpression(
        t.callExpression(
          t.memberExpression(t.identifier('worker'), t.identifier('start')),
          startArgs
        )
      )
    ),
    t.returnStatement(t.identifier('worker'))
  ]

  const fn = t.arrowFunctionExpression([], t.blockStatement(bodyStatements))
  fn.async = true
  return fn
}

// -------- CSF 3.0: ensure `loaders: [mswLoader(...)]`

type LoaderOutcome = 'changed' | 'unchanged' | 'conflict'

function ensureLoaderCall(
  previewObj: t.ObjectExpression,
  loaderName: string,
  setupFn: t.ArrowFunctionExpression | null,
  imports: AddonImports
): LoaderOutcome {
  const makeCall = () =>
    t.callExpression(t.identifier(loaderName), setupFn ? [setupFn] : [])

  const loadersProp = findObjectProperty(previewObj, 'loaders')

  if (!loadersProp) {
    // No loaders at all. Only wire the loader in when the file used the
    // addon (decorator or initialize) — which callers guarantee.
    previewObj.properties.unshift(
      t.objectProperty(t.identifier('loaders'), t.arrayExpression([makeCall()]))
    )
    return 'changed'
  }

  const value = loadersProp.value

  // `loaders: mswLoader` shorthand → `loaders: [mswLoader(...)]`
  if (
    t.isIdentifier(value) &&
    value.name === (imports.mswLoader ?? loaderName)
  ) {
    loadersProp.value = t.arrayExpression([makeCall()])
    return 'changed'
  }

  if (!t.isArrayExpression(value)) return 'unchanged'

  for (let i = 0; i < value.elements.length; i++) {
    const el = value.elements[i]
    if (el == null) continue
    // Bare reference: `loaders: [mswLoader]`
    if (t.isIdentifier(el) && el.name === (imports.mswLoader ?? loaderName)) {
      value.elements[i] = makeCall()
      return 'changed'
    }
    // Already a call: `loaders: [mswLoader()]`
    if (
      t.isCallExpression(el) &&
      t.isIdentifier(el.callee) &&
      el.callee.name === (imports.mswLoader ?? loaderName)
    ) {
      if (setupFn) {
        if (el.arguments.length > 0) return 'conflict'
        el.arguments.push(setupFn)
        return 'changed'
      }
      return 'unchanged'
    }
  }

  // Loaders array exists but has no msw entry — add one.
  value.elements.push(makeCall())
  return 'changed'
}

// -------- drop `mswLoader`/`mswDecorator` references

function stripMswRef(
  obj: t.ObjectExpression,
  propName: string,
  refName: string
): boolean {
  const prop = findObjectProperty(obj, propName)
  if (!prop) return false
  const value = prop.value

  if (t.isIdentifier(value) && value.name === refName) {
    obj.properties = obj.properties.filter((p) => p !== prop)
    return true
  }
  if (t.isArrayExpression(value)) {
    const before = value.elements.length
    value.elements = value.elements.filter((el) => {
      if (el == null) return true
      if (t.isIdentifier(el) && el.name === refName) return false
      if (
        t.isCallExpression(el) &&
        t.isIdentifier(el.callee) &&
        el.callee.name === refName
      )
        return false
      return true
    })
    if (value.elements.length === 0 && before > 0) {
      obj.properties = obj.properties.filter((p) => p !== prop)
      return true
    }
    return value.elements.length !== before
  }
  return false
}

// -------- CSF Next: ensure `addonMsw(...)` in `addons: [...]`

type AddonOutcome = 'changed' | 'unchanged' | 'conflict'

function ensureFactoriesAddon(
  parsed: ConfigFile,
  configObj: t.ObjectExpression,
  imports: AddonImports,
  setupFn: t.Expression | null,
  warnings: string[]
): AddonOutcome {
  let localName = imports.addonDefault

  const addonsProp = findObjectProperty(configObj, 'addons')
  const addonsArray =
    addonsProp && t.isArrayExpression(addonsProp.value)
      ? addonsProp.value
      : null

  const removeNamespaceEntry = (): boolean => {
    if (!imports.previewNamespace || !addonsArray) return false
    const before = addonsArray.elements.length
    addonsArray.elements = addonsArray.elements.filter(
      (el) =>
        !(el != null && t.isIdentifier(el) && el.name === imports.previewNamespace)
    )
    return addonsArray.elements.length !== before
  }

  // Look for an existing registration first (conflict detection must run
  // before any mutation).
  if (localName && addonsArray) {
    for (const el of addonsArray.elements) {
      if (el == null) continue
      const isBare = t.isIdentifier(el) && el.name === localName
      const isCall =
        t.isCallExpression(el) &&
        t.isIdentifier(el.callee) &&
        el.callee.name === localName
      if (!isBare && !isCall) continue
      if (setupFn) {
        if (isCall && (el as t.CallExpression).arguments.length > 0) {
          warnings.push(
            'A setup function could not be folded: the existing `addonMsw(...)` already receives one. Merge them by hand.'
          )
          return 'conflict'
        }
        if (isCall) {
          ;(el as t.CallExpression).arguments.push(setupFn)
          removeNamespaceEntry()
          return 'changed'
        }
      }
      // Registered and nothing to fold — done, but a leftover injected
      // namespace entry still gets cleaned up.
      return removeNamespaceEntry() ? 'changed' : 'unchanged'
    }
  }

  // Not registered yet — ensure the default import and inject the call.
  if (!localName) {
    localName = 'addonMsw'
    let attached = false
    for (const stmt of parsed._ast.program.body) {
      if (!t.isImportDeclaration(stmt)) continue
      if (stmt.source.value !== ADDON_PACKAGE) continue
      stmt.specifiers.unshift(t.importDefaultSpecifier(t.identifier(localName)))
      attached = true
      break
    }
    if (!attached) {
      parsed._ast.program.body.unshift(
        t.importDeclaration(
          [t.importDefaultSpecifier(t.identifier(localName))],
          t.stringLiteral(ADDON_PACKAGE)
        )
      )
    }
  }

  const call = t.callExpression(
    t.identifier(localName),
    setupFn ? [setupFn] : []
  )

  // The namespace entry injected by `storybook automigrate csf-factories`
  // (`addons: [mswStorybookAddon]`) is replaced in place.
  if (imports.previewNamespace && addonsArray) {
    const nsIndex = addonsArray.elements.findIndex(
      (el) =>
        el != null && t.isIdentifier(el) && el.name === imports.previewNamespace
    )
    if (nsIndex !== -1) {
      addonsArray.elements[nsIndex] = call
      return 'changed'
    }
  }

  if (!addonsProp) {
    configObj.properties.unshift(
      t.objectProperty(t.identifier('addons'), t.arrayExpression([call]))
    )
    return 'changed'
  }
  if (!addonsArray) {
    warnings.push(
      '`addons` in definePreview is not an array literal; register `addonMsw()` by hand.'
    )
    return 'conflict'
  }
  addonsArray.elements.unshift(call)
  return 'changed'
}

/** Setup function carried by `mswLoader(setup)` entries in `loaders`. */
function collectLoaderSetup(
  previewObj: t.ObjectExpression,
  loaderName: string
): t.Expression | null | 'conflict' {
  const prop = findObjectProperty(previewObj, 'loaders')
  if (!prop) return null

  const calls: t.CallExpression[] = []
  const consider = (el: t.Node | null | undefined) => {
    if (
      el != null &&
      t.isCallExpression(el) &&
      t.isIdentifier(el.callee) &&
      el.callee.name === loaderName &&
      el.arguments.length > 0
    ) {
      calls.push(el)
    }
  }
  if (t.isArrayExpression(prop.value)) {
    for (const el of prop.value.elements) consider(el)
  } else {
    consider(prop.value)
  }

  if (calls.length === 0) return null
  if (calls.length > 1 || calls[0].arguments.length > 1) return 'conflict'
  const arg = calls[0].arguments[0]
  return t.isExpression(arg) ? arg : 'conflict'
}

/** Index of a bare-identifier entry in `addons: [...]`, or -1. */
function findAddonsEntryIndex(
  previewObj: t.ObjectExpression,
  name: string
): number {
  const prop = findObjectProperty(previewObj, 'addons')
  if (!prop || !t.isArrayExpression(prop.value)) return -1
  return prop.value.elements.findIndex(
    (el) => el != null && t.isIdentifier(el) && el.name === name
  )
}

/** Drop `import * as x from 'msw-storybook-addon/preview'` once its
 *  `addons` entry has been replaced. */
function removePreviewNamespaceImport(parsed: ConfigFile): void {
  parsed._ast.program.body = parsed._ast.program.body.filter((stmt) => {
    if (!t.isImportDeclaration(stmt)) return true
    if (stmt.source.value !== PREVIEW_SUBPATH) return true
    return !stmt.specifiers.some((s) => t.isImportNamespaceSpecifier(s))
  })
}

// -------- opt-in: preview-level `parameters.msw` → `beforeEach`

function migratePreviewParameters(
  previewObj: t.ObjectExpression,
  warnings: string[]
): boolean {
  const parametersProp = findObjectProperty(previewObj, 'parameters')
  if (!parametersProp || !t.isObjectExpression(parametersProp.value))
    return false
  const parameters = parametersProp.value
  const mswProp = findObjectProperty(parameters, 'msw')
  if (!mswProp) return false

  const handlers = extractHandlers(mswProp.value)
  if (!handlers) {
    warnings.push(
      'Preview-level `parameters.msw` has a shape the codemod does not recognise; migrate it to `beforeEach({ msw })` by hand.'
    )
    return false
  }

  if (handlers.length > 0 && hasAnyProperty(previewObj, 'beforeEach')) {
    warnings.push(
      'The preview already defines `beforeEach`; merge the `parameters.msw` handlers into it by hand.'
    )
    return false
  }

  if (handlers.length > 0) {
    const beforeEachProp = buildBeforeEachProperty(handlers)
    const insertIdx = previewObj.properties.indexOf(parametersProp)
    previewObj.properties.splice(insertIdx, 0, beforeEachProp)
  }
  // An empty handler list (`msw: []`) is simply dropped.

  parameters.properties = parameters.properties.filter((p) => p !== mswProp)
  if (parameters.properties.length === 0) {
    previewObj.properties = previewObj.properties.filter(
      (p) => p !== parametersProp
    )
  }
  return true
}

// -------- helpers

function removeStatement(body: t.Statement[], stmt: t.Statement): void {
  const idx = body.indexOf(stmt)
  if (idx !== -1) body.splice(idx, 1)
}
