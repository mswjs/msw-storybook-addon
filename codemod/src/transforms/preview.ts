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
  isCsfFactoryPreview,
  itemText,
  lineIndent,
  loadConfig,
  parseExpression,
  prependToList,
  printConfig,
  reindent,
  removeFromList,
  removeStatement
} from 'storybook/internal/csf-tools'
import {
  beforeEachArrow,
  callText,
  findObjectProperty,
  handlersOf,
  mswValueOf
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

/** A top-level `initialize(...)` call, to be removed. */
interface InitializeCall {
  /** The setup function its arguments fold into; null for `initialize()`. */
  setup: string | null
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
  const csfNext = isCsfFactoryPreview(parsed)

  // Every edit is made in one transaction: when csf-tools refuses one (a
  // spread next to the field, a config binding used twice, ...), all of
  // them are rolled back and nothing is written.
  let skipped = false
  const kept = parsed.transaction(() => {
    skipped = !migratePreview(parsed, csfNext, options, warnings)
    return !skipped
  })
  if (!kept) {
    if (!skipped) warnings.push(refusedEditWarning(parsed))
    return { code: null, warnings, csfNext }
  }
  const code = printConfig(parsed).code
  return { code: code === source ? null : code, warnings, csfNext }
}

function refusedEditWarning(parsed: ConfigFile): string {
  const { path, message } = parsed.mutationDiagnostics.at(-1)!
  const field = path.length ? `\`${path.join('.')}\`` : 'the preview config'
  return `Could not edit ${field} (${message}); you will need to migrate this file yourself.`
}

/**
 * Fields of the preview config are edited through `ConfigFile`; array
 * elements, call arguments and the `initialize(...)` statement, which it
 * has no paths for, through its editor. Every edit is committed, which
 * parses the file again, so each step looks its nodes up afresh and
 * carries what it needs from an earlier parse over as source text.
 *
 * Returns false when the file is to be left as it is.
 */
function migratePreview(
  parsed: ConfigFile,
  csfNext: boolean,
  options: PreviewTransformOptions,
  warnings: string[]
): boolean {
  const imports = collectAddonImports(parsed._program.body)

  // `initialize` is analyzed before anything is edited.
  let initializeCall: InitializeCall | null = null
  if (imports.initialize) {
    const analyzed = analyzeInitialize(parsed, imports.initialize, warnings)
    if (analyzed === 'skip') return false
    initializeCall = analyzed
  }

  // The parser unwraps call-wrapped and variable-declared default exports,
  // so this covers `export default {}`, `export default definePreview({})`
  // and `const preview = definePreview({}); export default preview`.
  if (!parsed._exportsObject) {
    if (
      imports.initialize ||
      imports.mswLoader ||
      imports.mswDecorator ||
      imports.addonDefault
    ) {
      warnings.push(
        'Could not find the preview config object (the default export); you will need to migrate this file yourself.'
      )
    }
    return false
  }

  const migrated = csfNext
    ? migrateCsfNext(parsed, imports, initializeCall, warnings)
    : migrateCsf3(parsed, imports, initializeCall, warnings)
  if (!migrated) return false

  if (options.migrateParameters) migratePreviewParameters(parsed, warnings)
  return true
}

function migrateCsfNext(
  parsed: ConfigFile,
  imports: AddonImports,
  initializeCall: InitializeCall | null,
  warnings: string[]
): boolean {
  const { initialize, mswLoader, mswDecorator, previewNamespace } = imports

  // A setup function carried by an existing `mswLoader(setup)` moves onto
  // `addonMsw(setup)`. Collected before stripping the loader.
  const loaderSetup = collectLoaderSetup(parsed, mswLoader)
  if (loaderSetup === 'conflict') {
    warnings.push(
      'Multiple `mswLoader(...)` setup functions found; you will need to migrate this file yourself.'
    )
    return false
  }
  if (initializeCall?.setup && loaderSetup != null) {
    warnings.push(
      'Both `initialize(...)` options and a `mswLoader(...)` setup function exist; you will need to merge them into one setup function yourself.'
    )
    return false
  }

  const hasNamespaceEntry = findAddonsEntry(parsed, previewNamespace) != null
  const hasWiring =
    hasMswRef(parsed, 'loaders', mswLoader) ||
    hasMswRef(parsed, 'decorators', mswDecorator) ||
    hasNamespaceEntry ||
    initializeCall != null
  if (!hasWiring) return true

  const setup = initializeCall?.setup ?? loaderSetup
  if (!ensureFactoriesAddon(parsed, imports, setup, warnings)) return false

  // Stripped after `addons` is in place, so a config whose only field
  // was `loaders` keeps its layout.
  stripMswRef(parsed, 'loaders', mswLoader)
  stripMswRef(parsed, 'decorators', mswDecorator)
  removeInitializeCall(parsed, initialize)
  removeSpecifiers(parsed, ['initialize', 'mswLoader', 'mswDecorator'])
  if (previewNamespace && hasNamespaceEntry) {
    parsed.removeImport({ namespace: previewNamespace }, PREVIEW_SUBPATH)
  }
  if (initializeCall?.setup) parsed.setImport(['setupWorker'], MSW_BROWSER)
  return true
}

function migrateCsf3(
  parsed: ConfigFile,
  imports: AddonImports,
  initializeCall: InitializeCall | null,
  warnings: string[]
): boolean {
  const { initialize, mswLoader, mswDecorator } = imports

  // Only wire the loader when the file actually used the loader path
  // (loader, decorator, or initialize) — a stray default import alone is
  // not enough to justify injecting wiring.
  if (!mswLoader && !mswDecorator && !initializeCall) return true

  const setup = initializeCall?.setup ?? null
  if (!ensureLoaderCall(parsed, mswLoader ?? 'mswLoader', setup)) {
    warnings.push(
      '`initialize(...)` options could not be folded: the existing `mswLoader(...)` already receives a setup function. You will need to merge them yourself.'
    )
    return false
  }

  stripMswRef(parsed, 'decorators', mswDecorator)
  removeInitializeCall(parsed, initialize)
  removeSpecifiers(parsed, ['initialize', 'mswDecorator'])
  importLoaderFromCsf3(parsed)
  if (setup) parsed.setImport(['setupWorker'], MSW_BROWSER)
  return true
}

/** The value of a field of the preview config object, as written. */
function fieldValue(
  parsed: ConfigFile,
  name: string
): E.Expression | undefined {
  return findObjectProperty(parsed._exportsObject, name)?.value
}

/** Whether `node` is the identifier `name`. */
function isIdentifier(
  node: ESTreeNode | null | undefined,
  name: string | undefined
): node is E.IdentifierReference {
  return node?.type === 'Identifier' && node.name === name
}

/** Whether `node` is a call of the function `name`. */
function isCallOf(
  node: ESTreeNode | null | undefined,
  name: string | undefined
): node is E.CallExpression {
  return node?.type === 'CallExpression' && isIdentifier(node.callee, name)
}

/** `name` or `name(...)`. */
function isRef(
  node: ESTreeNode | null | undefined,
  name: string | undefined
): node is E.IdentifierReference | E.CallExpression {
  return isIdentifier(node, name) || isCallOf(node, name)
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

/** The value `import { name as local }` specifier of `source`, if any. */
function findNamedImport(
  parsed: ConfigFile,
  source: string,
  name: string
): E.ImportSpecifier | undefined {
  for (const stmt of parsed._program.body) {
    if (
      stmt.type !== 'ImportDeclaration' ||
      stmt.importKind === 'type' ||
      stmt.source.value !== source
    )
      continue
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

function isValueSpecifier(spec: E.ImportDeclarationSpecifier): boolean {
  return spec.type !== 'ImportSpecifier' || spec.importKind !== 'type'
}

/** Remove the given value imports from the addon; drop emptied declarations. */
function removeSpecifiers(parsed: ConfigFile, names: string[]): void {
  for (const source of [ADDON_PACKAGE, CSF3_SUBPATH]) {
    const present = names.filter((name) =>
      findNamedImport(parsed, source, name)
    )
    if (present.length > 0) parsed.removeImport(present, source)
  }
}

/** Import `mswLoader` from the /csf3 subpath, moving a root-package import there. */
function importLoaderFromCsf3(parsed: ConfigFile): void {
  const root = findNamedImport(parsed, ADDON_PACKAGE, 'mswLoader')
  const local = root?.local.name ?? 'mswLoader'
  if (root) parsed.removeImport(['mswLoader'], ADDON_PACKAGE)
  if (!findNamedImport(parsed, CSF3_SUBPATH, 'mswLoader')) {
    parsed.setImport(
      [local === 'mswLoader' ? local : `mswLoader as ${local}`],
      CSF3_SUBPATH
    )
  }
}

// -------- `initialize` analysis

function findInitializeCalls(
  body: Body,
  localName: string | undefined
): (E.ExpressionStatement & { expression: E.CallExpression })[] {
  return body.filter(
    (stmt): stmt is E.ExpressionStatement & { expression: E.CallExpression } =>
      stmt.type === 'ExpressionStatement' &&
      isCallOf(stmt.expression, localName)
  )
}

function analyzeInitialize(
  parsed: ConfigFile,
  localName: string,
  warnings: string[]
): InitializeCall | null | 'skip' {
  const editor = parsed._editor
  const calls = findInitializeCalls(parsed._program.body, localName)

  // Any other reference to `initialize` (captured return value, conditional
  // call, passing the function around) → we can't rewrite faithfully.
  const callees = new Set<ESTreeNode>(
    calls.map((stmt) => stmt.expression.callee)
  )
  const references =
    editor.scopes.program.bindings.get(localName)?.references ?? []
  if (references.some((ref) => !callees.has(ref))) {
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

  const call = calls[0].expression
  const [options, handlers] = call.arguments

  if (call.arguments.some((a) => a.type === 'SpreadElement')) {
    warnings.push(
      `\`${localName}(...)\` receives arguments the codemod cannot carry over (e.g. spreads); you will need to migrate this file yourself.`
    )
    return 'skip'
  }
  if (call.arguments.length > 2) {
    warnings.push(
      `\`${localName}(...)\` receives more than two arguments; you will need to migrate this file yourself.`
    )
    return 'skip'
  }
  if (!options) return { setup: null }

  const list = argumentList(editor, call)
  // An array literal of initial handlers is spread into `setupWorker(...)`
  // element by element (holes dropped); anything else is spread as a whole.
  const initialHandlers =
    handlers?.type === 'ArrayExpression'
      ? holeFreeElements(parsed, handlers)
      : handlers
        ? [`...${itemText(editor, list, list.items[1])}`]
        : []
  return {
    setup: setupFunction(
      parsed,
      itemText(editor, list, list.items[0]),
      initialHandlers
    )
  }
}

function holeFreeElements(
  parsed: ConfigFile,
  arr: E.ArrayExpression
): string[] {
  const editor = parsed._editor
  const list = arrayList(editor, arr)
  return list.items
    .filter((_, i) => arr.elements[i] != null)
    .map((item) => itemText(editor, list, item))
}

/** Remove the top-level `initialize(...)` call `analyzeInitialize` found. */
function removeInitializeCall(
  parsed: ConfigFile,
  localName: string | undefined
): void {
  const [stmt] = findInitializeCalls(parsed._program.body, localName)
  if (!stmt) return
  removeStatement(parsed._editor, stmt)
  parsed._editor.commit()
}

/**
 * The setup function `initialize(options, initialHandlers)` folds into:
 *
 *   async () => {
 *     const worker = setupWorker(...initialHandlers)
 *     await worker.start(options)
 *     return worker
 *   }
 */
function setupFunction(
  parsed: ConfigFile,
  options: string,
  handlers: string[]
): string {
  const { indent: step, semicolons } = parsed._editor
  const semi = semicolons ? ';' : ''
  const statements = [
    `const worker = ${callText('setupWorker', handlers, step)}${semi}`,
    `await ${callText('worker.start', [options], step)}${semi}`,
    `return worker${semi}`
  ]
  const body = statements
    .map((stmt) => `${step}${reindent(stmt, '', step)}`)
    .join('\n')
  return `async () => {\n${body}\n}`
}

// -------- CSF 3.0: ensure `loaders: [mswLoader(...)]`

/**
 * Returns false when the existing `mswLoader(...)` already receives a
 * setup function, so `setup` cannot be passed to it.
 */
function ensureLoaderCall(
  parsed: ConfigFile,
  loaderName: string,
  setup: string | null
): boolean {
  const call = callText(loaderName, setup ? [setup] : [], parsed._editor.indent)
  // The field as written: an identifier is not followed into a shared list.
  const loaders = fieldValue(parsed, 'loaders')

  // No loaders yet, or the `loaders: mswLoader` shorthand.
  if (!loaders || isIdentifier(loaders, loaderName)) {
    parsed.set(['loaders'], parseExpression(`[${call}]`))
    return true
  }
  if (loaders.type !== 'ArrayExpression') return true

  const entry = loaders.elements.find((el) => isRef(el, loaderName))
  if (!entry) {
    parsed.appendNodeToArray(['loaders'], parseExpression(call))
  } else if (entry.type === 'Identifier') {
    // `loaders: [mswLoader]`
    replaceNode(parsed, entry, call)
  } else if (setup) {
    // `loaders: [mswLoader()]`
    if (entry.arguments.length > 0) return false
    addFirstArgument(parsed, entry, setup)
  }
  return true
}

// -------- drop `mswLoader`/`mswDecorator` references

/** Whether the field `name` is `ref` or an array holding it. */
function hasMswRef(
  parsed: ConfigFile,
  name: string,
  ref: string | undefined
): boolean {
  const value = fieldValue(parsed, name)
  return value?.type === 'ArrayExpression'
    ? value.elements.some((el) => isRef(el, ref))
    : isIdentifier(value, ref)
}

/** Remove `ref` from the field `name`, and the field once nothing is left. */
function stripMswRef(
  parsed: ConfigFile,
  name: string,
  ref: string | undefined
): void {
  const value = fieldValue(parsed, name)
  if (isIdentifier(value, ref)) {
    parsed.remove([name])
    return
  }
  if (value?.type !== 'ArrayExpression') return
  const removed = value.elements.filter((el) => isRef(el, ref))
  if (removed.length === 0) return
  if (removed.length === value.elements.length) {
    parsed.remove([name])
    return
  }
  removeFromList(parsed._editor, arrayList(parsed._editor, value), removed)
  parsed._editor.commit()
}

// -------- CSF Next: ensure `addonMsw(...)` in `addons: [...]`

function addonsArrayOf(parsed: ConfigFile): E.ArrayExpression | undefined {
  const value = fieldValue(parsed, 'addons')
  return value?.type === 'ArrayExpression' ? value : undefined
}

/** A bare-identifier entry in `addons: [...]`, if there is one. */
function findAddonsEntry(
  parsed: ConfigFile,
  name: string | undefined
): E.IdentifierReference | undefined {
  return addonsArrayOf(parsed)?.elements.find((el) => isIdentifier(el, name))
}

/**
 * Register `addonMsw(setup)` in `addons`, replacing the namespace entry
 * `storybook automigrate csf-factories` injects. Returns false, after
 * adding a warning, when that cannot be done.
 */
function ensureFactoriesAddon(
  parsed: ConfigFile,
  imports: AddonImports,
  setup: string | null,
  warnings: string[]
): boolean {
  const editor = parsed._editor
  const { addonDefault, previewNamespace } = imports

  const registered = addonsArrayOf(parsed)?.elements.find((el) =>
    isRef(el, addonDefault)
  )
  if (registered) {
    if (setup && registered.type === 'CallExpression') {
      if (registered.arguments.length > 0) {
        warnings.push(
          'A setup function could not be folded: the existing `addonMsw(...)` already receives one. You will need to merge them yourself.'
        )
        return false
      }
      addFirstArgument(parsed, registered, setup)
    }
    // A leftover injected namespace entry still goes.
    const addons = addonsArrayOf(parsed)
    const leftover = addons?.elements.filter((el) =>
      isIdentifier(el, previewNamespace)
    )
    if (addons && leftover?.length) {
      removeFromList(editor, arrayList(editor, addons), leftover)
      editor.commit()
    }
    return true
  }

  const localName = addonDefault ?? 'addonMsw'
  if (!addonDefault) parsed.setImport(localName, ADDON_PACKAGE)
  const call = callText(localName, setup ? [setup] : [], editor.indent)

  const entry = findAddonsEntry(parsed, previewNamespace)
  if (entry) {
    replaceNode(parsed, entry, call)
    return true
  }
  const addons = fieldValue(parsed, 'addons')
  if (!addons) {
    parsed.set(['addons'], parseExpression(`[${call}]`))
    return true
  }
  if (addons.type !== 'ArrayExpression') {
    warnings.push(
      '`addons` in definePreview is not an array literal; you will need to register `addonMsw()` yourself.'
    )
    return false
  }
  prependToList(editor, arrayList(editor, addons), [call])
  editor.commit()
  return true
}

/** Source of the setup function carried by `mswLoader(setup)` entries in
 *  `loaders`. */
function collectLoaderSetup(
  parsed: ConfigFile,
  loaderName: string | undefined
): string | null | 'conflict' {
  const value = fieldValue(parsed, 'loaders')
  const entries = value?.type === 'ArrayExpression' ? value.elements : [value]
  const calls = entries.filter(
    (el): el is E.CallExpression =>
      isCallOf(el, loaderName) && el.arguments.length > 0
  )
  if (calls.length === 0) return null
  const [call] = calls
  if (
    calls.length > 1 ||
    call.arguments.length > 1 ||
    call.arguments[0].type === 'SpreadElement'
  )
    return 'conflict'
  const list = argumentList(parsed._editor, call)
  return itemText(parsed._editor, list, list.items[0])
}

// -------- opt-in: preview-level `parameters.msw` → `beforeEach`

function migratePreviewParameters(
  parsed: ConfigFile,
  warnings: string[]
): void {
  if (!mswValueOf(parsed._exportsObject)) return
  const msw = parsed.inspect(['parameters', 'msw'])
  const handlers = msw.kind === 'value' ? handlersOf(msw.node) : null
  if (!handlers) {
    warnings.push(
      'Preview-level `parameters.msw` has a shape the codemod does not recognize; you will need to migrate it to `beforeEach({ msw })` yourself.'
    )
    return
  }

  // A spread in the preview could hold a `beforeEach` as well.
  if (
    handlers.length > 0 &&
    parsed.inspect(['beforeEach']).kind !== 'missing'
  ) {
    warnings.push(
      'The preview already defines `beforeEach`; you will need to move the `parameters.msw` handlers into it yourself.'
    )
    return
  }

  // An empty handler list (`msw: []`) is simply dropped.
  parsed.remove(['parameters', 'msw'])
  if (handlers.length > 0) {
    parsed.set(
      ['beforeEach'],
      parseExpression(beforeEachArrow(handlers, parsed._editor.indent))
    )
  }
}
