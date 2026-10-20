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

import {
  argumentList,
  arrayList,
  type ConfigFile,
  type ESTree as E,
  type ESTreeNode,
  insertAfterImports,
  isCsfFactoryPreview,
  itemText,
  lineIndent,
  loadConfig,
  parseExpression,
  prependToList,
  printConfig,
  printString,
  reindent,
  removeFromList,
  removeStatement,
  setImportSpecifiers,
  walk
} from 'storybook/internal/csf-tools'
import {
  beforeEachArrow,
  callText,
  edited,
  extractHandlers,
  findObjectProperty,
  mswValueOf,
  read,
  RefusedEdit,
  semicolonFor
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

/** Source of the `initialize(...)` arguments to fold into a setup function. */
interface InitializeFold {
  /** `worker.start()` options — first argument, carried verbatim. */
  options?: string
  /** Initial handlers — second argument, spread into `setupWorker(...)`. */
  handlers?: string[]
}

// Fields of the preview config are edited through `ConfigFile`; array
// elements, call arguments and the `initialize(...)` statement, which it
// has no paths for, through its editor. Every edit is committed, which
// parses the file again, so each step looks its nodes up afresh — the
// preview object through `parsed._exportsObject` — and carries what it
// needs from an earlier parse over as source text.

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
  try {
    return migratePreview(parsed, source, options, warnings)
  } catch (error) {
    if (!(error instanceof RefusedEdit)) throw error
    // csf-tools refused an edit it cannot prove safe (a spread next to the
    // field, a binding used twice, ...). Nothing is written.
    const { path, message } = error.diagnostic
    const field =
      path.length > 0 ? `\`${path.join('.')}\`` : 'the preview config'
    warnings.push(
      `Could not edit ${field} (${message}); you will need to migrate this file yourself.`
    )
    return { code: null, warnings, csfNext: isCsfFactoryPreview(parsed) }
  }
}

function migratePreview(
  parsed: ConfigFile,
  source: string,
  options: PreviewTransformOptions,
  warnings: string[]
): PreviewTransformResult {
  const imports = collectAddonImports(parsed._program.body)
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
        'Could not find the preview config object (the default export); you will need to migrate this file yourself.'
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
      ? collectLoaderSetup(parsed, imports.mswLoader)
      : null
    if (loaderSetup === 'conflict') {
      warnings.push(
        'Multiple `mswLoader(...)` setup functions found; you will need to migrate this file yourself.'
      )
      return { code: null, warnings, csfNext: true }
    }
    if (needsSetup && loaderSetup != null) {
      warnings.push(
        'Both `initialize(...)` options and a `mswLoader(...)` setup function exist; you will need to merge them into one setup function yourself.'
      )
      return { code: null, warnings, csfNext: true }
    }

    const hasLoader =
      imports.mswLoader != null &&
      hasMswRef(parsed, 'loaders', imports.mswLoader)
    const hasDecorator =
      imports.mswDecorator != null &&
      hasMswRef(parsed, 'decorators', imports.mswDecorator)
    const hasNamespaceEntry =
      imports.previewNamespace != null &&
      findAddonsEntry(parsed, imports.previewNamespace) != null
    const hasWiring =
      hasLoader || hasDecorator || hasNamespaceEntry || fold != null

    if (!hasWiring) {
      if (options.migrateParameters) {
        if (migratePreviewParameters(parsed, warnings)) changed = true
      }
      return finish(parsed, source, changed, warnings, true)
    }

    // Ensure the addon is registered, folding the setup function in.
    const setupFn = needsSetup
      ? buildSetupFunction(parsed, fold as InitializeFold)
      : loaderSetup
    const addonResult = ensureFactoriesAddon(parsed, imports, setupFn, warnings)
    if (addonResult === 'conflict') {
      return { code: null, warnings, csfNext: true }
    }
    changed = true

    // Stripped after `addons` is in place, so a config whose only field
    // was `loaders` keeps its layout.
    if (hasLoader) stripMswRef(parsed, 'loaders', imports.mswLoader as string)
    if (hasDecorator) {
      stripMswRef(parsed, 'decorators', imports.mswDecorator as string)
    }

    if (fold != null) {
      removeInitializeCall(parsed, imports.initialize as string)
    }
    removeSpecifiers(parsed, ['initialize', 'mswLoader', 'mswDecorator'])
    if (hasNamespaceEntry) {
      removeNamespaceImport(
        parsed,
        PREVIEW_SUBPATH,
        imports.previewNamespace as string
      )
    }
    if (needsSetup) {
      addNamedImport(parsed, MSW_BROWSER, 'setupWorker', 'setupWorker')
    }
  } else {
    // ---- CSF 3.0 --------------------------------------------------------
    // Only wire the loader when the file actually used the loader path
    // (loader, decorator, or initialize) — a stray default import alone is
    // not enough to justify injecting wiring.
    const usesLoaderPath =
      imports.mswLoader != null || imports.mswDecorator != null || fold != null
    if (!usesLoaderPath) {
      if (options.migrateParameters) {
        if (migratePreviewParameters(parsed, warnings)) changed = true
      }
      return finish(parsed, source, changed, warnings, false)
    }

    const loaderName = imports.mswLoader ?? 'mswLoader'
    const setupFn = needsSetup
      ? buildSetupFunction(parsed, fold as InitializeFold)
      : null

    const loaderResult = ensureLoaderCall(parsed, loaderName, setupFn)
    if (loaderResult === 'conflict') {
      warnings.push(
        '`initialize(...)` options could not be folded: the existing `mswLoader(...)` already receives a setup function. You will need to merge them yourself.'
      )
      return { code: null, warnings, csfNext: false }
    }
    if (loaderResult === 'changed') changed = true

    if (imports.mswDecorator) {
      if (stripMswRef(parsed, 'decorators', imports.mswDecorator))
        changed = true
    }

    if (fold != null) {
      removeInitializeCall(parsed, imports.initialize as string)
      changed = true
    }

    if (removeSpecifiers(parsed, ['initialize', 'mswDecorator'])) changed = true
    if (retargetLoaderImport(parsed)) changed = true
    if (addNamedImport(parsed, CSF3_SUBPATH, 'mswLoader', 'mswLoader')) {
      changed = true
    }
    if (needsSetup) {
      addNamedImport(parsed, MSW_BROWSER, 'setupWorker', 'setupWorker')
    }
  }

  if (options.migrateParameters) {
    if (migratePreviewParameters(parsed, warnings)) changed = true
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

/** The preview config object of the current parse. */
function previewObject(parsed: ConfigFile): E.ObjectExpression {
  return parsed._exportsObject as E.ObjectExpression
}

/** Overwrite a node with code built from column zero, and commit. */
function replaceNode(parsed: ConfigFile, node: ESTreeNode, text: string): void {
  const editor = parsed._editor
  editor.edits.overwrite(
    node.start,
    node.end,
    reindent(text, '', lineIndent(editor.code, node.start))
  )
  editor.commit()
}

/** Pass an argument, built from column zero, to a call without arguments. */
function addFirstArgument(
  parsed: ConfigFile,
  call: E.CallExpression,
  text: string
): void {
  const editor = parsed._editor
  editor.edits.appendLeft(
    call.end - 1,
    reindent(text, '', lineIndent(editor.code, call.start))
  )
  editor.commit()
}

// -------- imports

type Body = E.Program['body']

function collectAddonImports(body: Body): AddonImports {
  const out: AddonImports = {}
  for (const stmt of body) {
    if (stmt.type !== 'ImportDeclaration' || stmt.importKind === 'type')
      continue
    const src = stmt.source.value
    if (src === PREVIEW_SUBPATH) {
      for (const spec of stmt.specifiers) {
        if (spec.type === 'ImportNamespaceSpecifier') {
          out.previewNamespace = spec.local.name
        }
      }
      continue
    }
    if (src !== ADDON_PACKAGE && src !== CSF3_SUBPATH) continue
    for (const spec of stmt.specifiers) {
      if (spec.type === 'ImportDefaultSpecifier') {
        out.addonDefault = spec.local.name
      } else if (spec.type === 'ImportSpecifier' && isValueSpecifier(spec)) {
        const name = importedName(spec)
        if (name === 'initialize') out.initialize = spec.local.name
        if (name === 'mswLoader') out.mswLoader = spec.local.name
        if (name === 'mswDecorator') out.mswDecorator = spec.local.name
      }
    }
  }
  return out
}

function importedName(spec: E.ImportSpecifier): string {
  const imported = spec.imported
  return imported.type === 'Literal' ? imported.value : imported.name
}

// Imports are edited through the editor's import helpers rather than
// `ConfigFile#setImport`/`removeImport`, which only look at the first
// declaration of a source and also take `import type` declarations.

function isValueImport(
  stmt: Body[number],
  source: string
): stmt is E.ImportDeclaration {
  return (
    stmt.type === 'ImportDeclaration' &&
    stmt.importKind !== 'type' &&
    stmt.source.value === source
  )
}

function isValueSpecifier(spec: E.ImportDeclarationSpecifier): boolean {
  return spec.type !== 'ImportSpecifier' || spec.importKind !== 'type'
}

/** The value `import { name as local }` specifier of `source`, if any. */
function findNamedImport(
  parsed: ConfigFile,
  source: string,
  name: string
): E.ImportSpecifier | undefined {
  for (const stmt of parsed._program.body) {
    if (!isValueImport(stmt, source)) continue
    for (const spec of stmt.specifiers) {
      if (
        spec.type === 'ImportSpecifier' &&
        isValueSpecifier(spec) &&
        importedName(spec) === name
      )
        return spec
    }
  }
  return undefined
}

function declarationOf(
  parsed: ConfigFile,
  spec: E.ImportDeclarationSpecifier
): E.ImportDeclaration {
  return parsed._program.body.find(
    (stmt): stmt is E.ImportDeclaration =>
      stmt.type === 'ImportDeclaration' && stmt.specifiers.includes(spec)
  ) as E.ImportDeclaration
}

/** Drop specifiers from their declaration, and the declaration once empty. */
function removeFromImport(
  parsed: ConfigFile,
  stmt: E.ImportDeclaration,
  removed: readonly E.ImportDeclarationSpecifier[]
): void {
  const kept = stmt.specifiers.filter((spec) => !removed.includes(spec))
  if (kept.length === 0) removeStatement(parsed._editor, stmt)
  else setImportSpecifiers(parsed._editor, stmt, kept)
  parsed._editor.commit()
}

/** Remove the given specifiers from addon imports; drop emptied declarations. */
function removeSpecifiers(parsed: ConfigFile, names: string[]): boolean {
  let changed = false
  for (;;) {
    const spec = [ADDON_PACKAGE, CSF3_SUBPATH]
      .flatMap((source) =>
        names.map((name) => findNamedImport(parsed, source, name))
      )
      .find((found) => found != null)
    if (!spec) return changed
    // Genuine side-effect imports never had specifiers to remove, so only
    // declarations emptied here are dropped.
    removeFromImport(parsed, declarationOf(parsed, spec), [spec])
    changed = true
  }
}

/**
 * Ensure a value import of `name` from `source`, written as `specText`. It
 * joins the first value import of `source`, or else goes after the last
 * import.
 */
function addNamedImport(
  parsed: ConfigFile,
  source: string,
  name: string,
  specText: string
): boolean {
  if (findNamedImport(parsed, source, name)) return false
  const editor = parsed._editor
  const stmt = parsed._program.body.find(
    (s): s is E.ImportDeclaration =>
      isValueImport(s, source) &&
      !s.specifiers.some((spec) => spec.type === 'ImportNamespaceSpecifier')
  )
  if (stmt) {
    setImportSpecifiers(editor, stmt, stmt.specifiers, { named: [specText] })
  } else {
    insertAfterImports(
      editor,
      `import { ${specText} } from ${printString(source, editor.quote)}${semicolonFor(editor)}`
    )
  }
  editor.commit()
  return true
}

/** Ensure `import <localName> from '<source>'`. */
function addDefaultImport(
  parsed: ConfigFile,
  source: string,
  localName: string
): void {
  const editor = parsed._editor
  const stmt = parsed._program.body.find(
    (s): s is E.ImportDeclaration =>
      isValueImport(s, source) &&
      !s.specifiers.some((spec) => spec.type === 'ImportDefaultSpecifier')
  )
  if (stmt) {
    setImportSpecifiers(editor, stmt, stmt.specifiers, { default: localName })
  } else {
    insertAfterImports(
      editor,
      `import ${localName} from ${printString(source, editor.quote)}${semicolonFor(editor)}`
    )
  }
  editor.commit()
}

/** Drop `import * as <localName> from '<source>'`. */
function removeNamespaceImport(
  parsed: ConfigFile,
  source: string,
  localName: string
): void {
  for (const stmt of parsed._program.body) {
    if (!isValueImport(stmt, source)) continue
    const spec = stmt.specifiers.find(
      (s) => s.type === 'ImportNamespaceSpecifier' && s.local.name === localName
    )
    if (spec) return removeFromImport(parsed, stmt, [spec])
  }
}

/** Move a root-package `mswLoader` specifier onto the /csf3 subpath. */
function retargetLoaderImport(parsed: ConfigFile): boolean {
  const spec = findNamedImport(parsed, ADDON_PACKAGE, 'mswLoader')
  if (!spec) return false
  const localName = spec.local.name
  const editor = parsed._editor
  const decl = declarationOf(parsed, spec)
  if (decl.specifiers.length === 1) {
    // The import only brings `mswLoader`: point it at the subpath in place,
    // with the quote it is written with.
    editor.edits.overwrite(
      decl.source.start,
      decl.source.end,
      printString(CSF3_SUBPATH, editor.code[decl.source.start])
    )
    editor.commit()
    return true
  }
  removeFromImport(parsed, decl, [spec])
  addNamedImport(
    parsed,
    CSF3_SUBPATH,
    'mswLoader',
    localName === 'mswLoader' ? localName : `mswLoader as ${localName}`
  )
  return true
}

// -------- `initialize` analysis

function findInitializeCalls(
  body: Body,
  localName: string
): E.ExpressionStatement[] {
  return body.filter(
    (stmt): stmt is E.ExpressionStatement =>
      stmt.type === 'ExpressionStatement' &&
      stmt.expression.type === 'CallExpression' &&
      stmt.expression.callee.type === 'Identifier' &&
      stmt.expression.callee.name === localName
  )
}

function analyzeInitialize(
  parsed: ConfigFile,
  localName: string,
  warnings: string[]
): InitializeFold | null | 'skip' {
  const editor = parsed._editor
  const body = parsed._program.body
  const calls = findInitializeCalls(body, localName)
  const knownNodes = new Set<ESTreeNode>()
  for (const stmt of body) {
    if (stmt.type === 'ImportDeclaration') knownNodes.add(stmt)
  }
  for (const stmt of calls) {
    knownNodes.add((stmt.expression as E.CallExpression).callee)
  }

  // Any other reference to `initialize` (captured return value, conditional
  // call, passing the function around) → we can't rewrite faithfully.
  if (countIdentifierReferences(parsed._program, localName, knownNodes) > 0) {
    warnings.push(
      `\`${localName}\` is used in a way the codemod cannot rewrite (e.g. its return value is captured, or it is called conditionally). You will need to migrate this file yourself — see the "initialize is removed" section of the migration guide.`
    )
    return 'skip'
  }

  if (calls.length === 0) {
    // Imported but never called — just drop the import.
    return null
  }

  if (calls.length > 1) {
    warnings.push(
      `Multiple \`${localName}(...)\` calls found; you will need to migrate this file yourself.`
    )
    return 'skip'
  }

  const call = calls[0].expression as E.CallExpression
  const args = call.arguments

  if (args.some((a) => a.type === 'SpreadElement')) {
    warnings.push(
      `\`${localName}(...)\` receives arguments the codemod cannot carry over (e.g. spreads); you will need to migrate this file yourself.`
    )
    return 'skip'
  }
  if (args.length > 2) {
    warnings.push(
      `\`${localName}(...)\` receives more than two arguments; you will need to migrate this file yourself.`
    )
    return 'skip'
  }

  const list = argumentList(editor, call)
  const fold: InitializeFold = {}
  if (args[0]) fold.options = itemText(editor, list, list.items[0])
  if (args[1]) {
    // An array literal is spread into `setupWorker(...)` element by element
    // (holes dropped); anything else is spread as a whole.
    fold.handlers =
      args[1].type === 'ArrayExpression'
        ? holeFreeElements(parsed, args[1])
        : [`...${itemText(editor, list, list.items[1])}`]
  }
  return fold
}

function holeFreeElements(
  parsed: ConfigFile,
  arr: E.ArrayExpression
): string[] {
  const editor = parsed._editor
  const list = arrayList(editor, arr)
  const out: string[] = []
  arr.elements.forEach((el, i) => {
    if (el != null) out.push(itemText(editor, list, list.items[i]))
  })
  return out
}

/** Count `Identifier` references to `name`, ignoring the given nodes and
 *  non-reference positions we can cheaply detect (member properties and
 *  non-computed object keys). Conservative: an unexplained occurrence makes
 *  the caller skip the file. */
function countIdentifierReferences(
  root: ESTreeNode,
  name: string,
  ignore: Set<ESTreeNode>
): number {
  let count = 0
  walk(root, (node, parent) => {
    if (ignore.has(node)) return false
    if (node.type !== 'Identifier' || node.name !== name) return
    // Skip non-reference identifier positions. A shorthand property's key
    // is its value as well, so it does count.
    if (
      parent?.type === 'MemberExpression' &&
      parent.property === node &&
      !parent.computed
    )
      return false
    if (
      parent?.type === 'Property' &&
      parent.key === node &&
      !parent.computed &&
      !parent.shorthand
    )
      return false
    count++
    return false
  })
  return count
}

/** Remove the top-level `initialize(...)` call `analyzeInitialize` found. */
function removeInitializeCall(parsed: ConfigFile, localName: string): void {
  const [stmt] = findInitializeCalls(parsed._program.body, localName)
  if (!stmt) return
  removeStatement(parsed._editor, stmt)
  parsed._editor.commit()
}

// -------- setup function builder
//
//   async () => {
//     const worker = setupWorker(...initialHandlers)
//     await worker.start(options)
//     return worker
//   }

function buildSetupFunction(parsed: ConfigFile, fold: InitializeFold): string {
  const editor = parsed._editor
  const step = editor.indent
  const semi = semicolonFor(editor)
  const startArgs = fold.options != null ? [fold.options] : []
  const statements = [
    `const worker = ${callText('setupWorker', fold.handlers ?? [], step)}${semi}`,
    `await ${callText('worker.start', startArgs, step)}${semi}`,
    `return worker${semi}`
  ]
  const body = statements
    .map((stmt) => `${step}${reindent(stmt, '', step)}`)
    .join('\n')
  return `async () => {\n${body}\n}`
}

// -------- CSF 3.0: ensure `loaders: [mswLoader(...)]`

type LoaderOutcome = 'changed' | 'unchanged' | 'conflict'

function ensureLoaderCall(
  parsed: ConfigFile,
  loaderName: string,
  setupFn: string | null
): LoaderOutcome {
  const call = callText(
    loaderName,
    setupFn ? [setupFn] : [],
    parsed._editor.indent
  )
  // The field as written: an identifier is not followed into a shared list.
  const loaders = findObjectProperty(previewObject(parsed), 'loaders')?.value

  // No loaders at all: only wired in when the file used the addon
  // (decorator or initialize) — which callers guarantee. `loaders:
  // mswLoader` shorthand → `loaders: [mswLoader(...)]`.
  if (
    !loaders ||
    (loaders.type === 'Identifier' && loaders.name === loaderName)
  ) {
    // Removed and added again rather than set in place: `set` writes a new
    // field indented like the object, an existing one as given.
    edited(parsed.remove(['loaders']))
    edited(parsed.set(['loaders'], parseExpression(`[${call}]`)))
    return 'changed'
  }

  if (loaders.type !== 'ArrayExpression') return 'unchanged'

  for (const el of loaders.elements) {
    if (el == null) continue
    // Bare reference: `loaders: [mswLoader]`
    if (el.type === 'Identifier' && el.name === loaderName) {
      replaceNode(parsed, el, call)
      return 'changed'
    }
    // Already a call: `loaders: [mswLoader()]`
    if (
      el.type === 'CallExpression' &&
      el.callee.type === 'Identifier' &&
      el.callee.name === loaderName
    ) {
      if (setupFn) {
        if (el.arguments.length > 0) return 'conflict'
        addFirstArgument(parsed, el, setupFn)
        return 'changed'
      }
      return 'unchanged'
    }
  }

  // Loaders array exists but has no msw entry — add one.
  parsed.appendNodeToArray(['loaders'], parseExpression(call))
  return 'changed'
}

// -------- drop `mswLoader`/`mswDecorator` references

function isRef(el: ESTreeNode | null, refName: string): boolean {
  if (el == null) return false
  if (el.type === 'Identifier' && el.name === refName) return true
  return (
    el.type === 'CallExpression' &&
    el.callee.type === 'Identifier' &&
    el.callee.name === refName
  )
}

/** Whether `propName` is `refName` or an array holding it. */
function hasMswRef(
  parsed: ConfigFile,
  propName: string,
  refName: string
): boolean {
  const value = findObjectProperty(previewObject(parsed), propName)?.value
  if (!value) return false
  if (value.type === 'ArrayExpression') {
    return value.elements.some((el) => isRef(el, refName))
  }
  return value.type === 'Identifier' && value.name === refName
}

function stripMswRef(
  parsed: ConfigFile,
  propName: string,
  refName: string
): boolean {
  const value = findObjectProperty(previewObject(parsed), propName)?.value
  if (!value) return false

  if (value.type === 'Identifier' && value.name === refName) {
    edited(parsed.remove([propName]))
    return true
  }
  if (value.type === 'ArrayExpression') {
    const removed = value.elements.filter(
      (el): el is E.Expression | E.SpreadElement => isRef(el, refName)
    )
    if (removed.length === 0) return false
    if (removed.length === value.elements.length) {
      // Nothing left: the property goes as well.
      edited(parsed.remove([propName]))
      return true
    }
    removeFromList(parsed._editor, arrayList(parsed._editor, value), removed)
    parsed._editor.commit()
    return true
  }
  return false
}

// -------- CSF Next: ensure `addonMsw(...)` in `addons: [...]`

type AddonOutcome = 'changed' | 'unchanged' | 'conflict'

function addonsArrayOf(parsed: ConfigFile): E.ArrayExpression | null {
  const value = findObjectProperty(previewObject(parsed), 'addons')?.value
  return value?.type === 'ArrayExpression' ? value : null
}

function ensureFactoriesAddon(
  parsed: ConfigFile,
  imports: AddonImports,
  setupFn: string | null,
  warnings: string[]
): AddonOutcome {
  const editor = parsed._editor
  let localName = imports.addonDefault

  const removeNamespaceEntry = (): boolean => {
    const addonsArray = addonsArrayOf(parsed)
    if (!imports.previewNamespace || !addonsArray) return false
    const removed = addonsArray.elements.filter(
      (el): el is E.IdentifierReference =>
        el?.type === 'Identifier' && el.name === imports.previewNamespace
    )
    if (removed.length === 0) return false
    removeFromList(editor, arrayList(editor, addonsArray), removed)
    editor.commit()
    return true
  }

  // Look for an existing registration first (conflict detection must run
  // before any mutation).
  const existing = addonsArrayOf(parsed)
  if (localName && existing) {
    for (const el of existing.elements) {
      if (el == null) continue
      const isBare = el.type === 'Identifier' && el.name === localName
      const isCall =
        el.type === 'CallExpression' &&
        el.callee.type === 'Identifier' &&
        el.callee.name === localName
      if (!isBare && !isCall) continue
      if (setupFn) {
        if (isCall && (el as E.CallExpression).arguments.length > 0) {
          warnings.push(
            'A setup function could not be folded: the existing `addonMsw(...)` already receives one. You will need to merge them yourself.'
          )
          return 'conflict'
        }
        if (isCall) {
          addFirstArgument(parsed, el as E.CallExpression, setupFn)
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
    addDefaultImport(parsed, ADDON_PACKAGE, localName)
  }

  const call = callText(localName, setupFn ? [setupFn] : [], editor.indent)
  const addonsField = findObjectProperty(previewObject(parsed), 'addons')
  const addonsArray = addonsArrayOf(parsed)

  // The namespace entry injected by `storybook automigrate csf-factories`
  // (`addons: [mswStorybookAddon]`) is replaced in place.
  const entry =
    imports.previewNamespace != null
      ? findAddonsEntry(parsed, imports.previewNamespace)
      : undefined
  if (entry) {
    replaceNode(parsed, entry, call)
    return 'changed'
  }

  if (!addonsField) {
    edited(parsed.set(['addons'], parseExpression(`[${call}]`)))
    return 'changed'
  }
  if (!addonsArray) {
    warnings.push(
      '`addons` in definePreview is not an array literal; you will need to register `addonMsw()` yourself.'
    )
    return 'conflict'
  }
  prependToList(editor, arrayList(editor, addonsArray), [call])
  editor.commit()
  return 'changed'
}

/** Source of the setup function carried by `mswLoader(setup)` entries in
 *  `loaders`. */
function collectLoaderSetup(
  parsed: ConfigFile,
  loaderName: string
): string | null | 'conflict' {
  const value = findObjectProperty(previewObject(parsed), 'loaders')?.value
  if (!value) return null

  const calls: E.CallExpression[] = []
  const consider = (el: ESTreeNode | null) => {
    if (
      el != null &&
      el.type === 'CallExpression' &&
      el.callee.type === 'Identifier' &&
      el.callee.name === loaderName &&
      el.arguments.length > 0
    ) {
      calls.push(el)
    }
  }
  if (value.type === 'ArrayExpression') {
    for (const el of value.elements) consider(el)
  } else {
    consider(value)
  }

  if (calls.length === 0) return null
  if (calls.length > 1 || calls[0].arguments.length > 1) return 'conflict'
  if (calls[0].arguments[0].type === 'SpreadElement') return 'conflict'
  const list = argumentList(parsed._editor, calls[0])
  return itemText(parsed._editor, list, list.items[0])
}

/** A bare-identifier entry in `addons: [...]`, if there is one. */
function findAddonsEntry(
  parsed: ConfigFile,
  name: string
): ESTreeNode | undefined {
  return (
    addonsArrayOf(parsed)?.elements.find(
      (el) => el?.type === 'Identifier' && el.name === name
    ) ?? undefined
  )
}

// -------- opt-in: preview-level `parameters.msw` → `beforeEach`

function migratePreviewParameters(
  parsed: ConfigFile,
  warnings: string[]
): boolean {
  const mswValue = mswValueOf(previewObject(parsed))
  if (!mswValue) return false
  // csf-tools must be able to prove the field too: a spread or a duplicate
  // key around it makes the edit unsafe.
  const handlers = read(parsed, () => parsed.get(['parameters', 'msw'])).value
    ? extractHandlers(parsed._editor, mswValue)
    : null
  if (!handlers) {
    warnings.push(
      'Preview-level `parameters.msw` has a shape the codemod does not recognize; you will need to migrate it to `beforeEach({ msw })` yourself.'
    )
    return false
  }

  if (handlers.length > 0) {
    // A spread in the preview could hold a `beforeEach` as well.
    const beforeEach = read(parsed, () => parsed.get(['beforeEach']))
    if (!beforeEach.proven || beforeEach.value) {
      warnings.push(
        'The preview already defines `beforeEach`; you will need to move the `parameters.msw` handlers into it yourself.'
      )
      return false
    }
  }

  // An empty handler list (`msw: []`) is simply dropped.
  edited(parsed.remove(['parameters', 'msw']))
  if (handlers.length > 0) {
    edited(
      parsed.set(
        ['beforeEach'],
        parseExpression(beforeEachArrow(handlers, parsed._editor.indent))
      )
    )
  }
  return true
}
