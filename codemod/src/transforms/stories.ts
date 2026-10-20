/**
 * Story-file transform.
 * Migrates `parameters.msw.handlers` (and its legacy shapes) into a
 * `beforeEach({ msw }) { msw.use(...) }` annotation. Idempotent: a file
 * that no longer carries `parameters.msw` is left untouched.
 * Only shapes the transform can prove safe are rewritten:
 *   - `RequestHandler[]` (legacy array form)
 *   - `{ handlers: RequestHandler[] }`
 *   - `{ handlers: Record<string, RequestHandler | RequestHandler[]> }`
 * Anything else (custom keys, dynamic values, etc.) is skipped while
 * the user gets a warning to migrate by hand.
 * CSF3 (story-as-object), CSF factories and CSF2 (post-export
 * `Story.parameters = ...` annotation) are handled.
 *
 * The edits go through Storybook's csf-tools: `CsfFile.objects()` gives an
 * editor per meta, story and CSF2 annotation, and code nobody edits stays
 * as written.
 */

import {
  arrayList,
  type CsfFile,
  type CsfMutationDiagnostic,
  type CsfMutationResult,
  type CsfObject,
  type CsfObjectTarget,
  type ESTree as E,
  type ESTreeNode,
  itemText,
  lineIndent,
  loadCsf,
  parseExpression,
  placeableTextOf,
  printCsf,
  reindent,
  removeStatement,
  type SourceEditor,
  statementSpan,
  staticKey,
  unwrapExpression
} from 'storybook/internal/csf-tools'

/** Why a story was left alone. The CLI phrases its guidance per reason. */
export type SkipReason = 'unrecognized-shape' | 'existing-before-each'

export interface SkippedStory {
  story: string
  reason: SkipReason
}

export interface StoryTransformResult {
  /** Transformed source, or null when no changes were needed. */
  code: string | null
  /** Stories we refused to migrate, with the reason. The CLI surfaces
   *  these as warnings so the user can migrate them themselves. */
  skippedStories: SkippedStory[]
}

const MSW_PATH = ['parameters', 'msw']

export function transformStory(source: string): StoryTransformResult {
  const skipped: SkippedStory[] = []
  let parsed: CsfFile
  try {
    parsed = loadCsf(source, {
      makeTitle: (title?: string) => title || 'default'
    }).parse()
  } catch {
    // Not parseable as CSF — leave alone.
    return { code: null, skippedStories: [] }
  }

  let changed = false
  for (const object of parsed.objects()) {
    let result: MigrationOutcome
    try {
      result =
        object.target.kind === 'story-annotation'
          ? migrateCsf2Annotation(parsed, object, object.target)
          : migrateMswOnObject(parsed, object)
    } catch (error) {
      if (!(error instanceof RefusedEdit)) throw error
      // An edit was refused halfway through a story: the file is left as
      // it was rather than written with the handlers half moved.
      skipped.push({
        story: storyName(object.target),
        reason: 'unrecognized-shape'
      })
      return { code: null, skippedStories: skipped }
    }
    if (result === 'changed') changed = true
    else if (result !== 'noop')
      skipped.push({ story: storyName(object.target), reason: result })
  }

  if (!changed) {
    return { code: null, skippedStories: skipped }
  }
  return { code: printCsf(parsed).code, skippedStories: skipped }
}

function storyName(target: CsfObjectTarget): string {
  return 'exportName' in target ? target.exportName : 'meta'
}

// -------- per-object migration

type MigrationOutcome = 'changed' | 'noop' | SkipReason

/** CSF3 and CSF factory metas and stories: object literals. */
function migrateMswOnObject(
  parsed: CsfFile,
  object: CsfObject
): MigrationOutcome {
  const mswValue = mswValueOf(objectNodeOf(parsed, object.target))
  if (!mswValue) return 'noop'
  // csf-tools must be able to prove the field too: a spread or a duplicate
  // key around it makes the edit unsafe.
  if (!read(parsed, () => object.get(MSW_PATH)).value) {
    return 'unrecognized-shape'
  }
  const handlers = extractHandlers(parsed._editor, mswValue)
  if (!handlers) {
    // Unrecognised shape — leave the file alone for THIS story.
    return 'unrecognized-shape'
  }

  if (handlers.length > 0) {
    // Refuse to silently overwrite an existing beforeEach. The user merges
    // the handlers into it themselves; we'd rather skip than blow away
    // their code. `get` reads both `beforeEach: () => {}` and
    // `beforeEach() {}`; a spread could hold one as well.
    const beforeEach = read(parsed, () => object.get(['beforeEach']))
    if (!beforeEach.proven) return 'unrecognized-shape'
    if (beforeEach.value) return 'existing-before-each'
  }

  // Strip `msw` from `parameters`; `parameters` goes as well once empty.
  // An empty handler list (`msw: []`) has nothing to carry over — the
  // parameter is simply dropped.
  if (!object.remove(MSW_PATH).ok) return 'unrecognized-shape'
  if (handlers.length > 0) {
    edited(
      object.set(
        ['beforeEach'],
        parseExpression(beforeEachArrow(handlers, parsed._editor.indent))
      )
    )
  }
  return 'changed'
}

/** A csf-tools edit that was refused after earlier edits went through. */
export class RefusedEdit extends Error {
  constructor(readonly diagnostic: CsfMutationDiagnostic) {
    super(diagnostic.message)
  }
}

/** Throw `RefusedEdit` for a mutation csf-tools did not apply. */
export function edited(result: CsfMutationResult): void {
  if (!result.ok) throw new RefusedEdit(result.diagnostic)
}

/**
 * A read through a csf-tools editor. `proven` is false when the read added
 * a diagnostic: a spread, a duplicate key or a getter leaves the field's
 * presence and value unproven, and `value` is then undefined too.
 */
export function read(
  file: { readonly mutationDiagnostics: readonly unknown[] },
  get: () => ESTreeNode | undefined
): { value?: ESTreeNode; proven: boolean } {
  const before = file.mutationDiagnostics.length
  const value = get()
  return file.mutationDiagnostics.length > before
    ? { proven: false }
    : { value, proven: true }
}

/** The object literal a meta or story editor edits. */
export function objectNodeOf(
  parsed: CsfFile,
  target: CsfObjectTarget
): E.ObjectExpression | undefined {
  if (target.kind === 'meta') {
    return parsed._metaNodeIsSynthetic ? undefined : parsed._metaNode
  }
  if (target.kind !== 'story') return undefined
  // The story's binding, which also covers `export { A as B }`.
  const decl = parsed._editor.scopes.program.bindings.get(target.localName)
    ?.node as ESTreeNode | undefined
  let node: ESTreeNode | null | undefined =
    decl?.type === 'VariableDeclarator' ? decl.init : undefined
  node = node && unwrapExpression(node)
  // CSF factories: `meta.story({...})`.
  if (node?.type === 'CallExpression' && node.arguments[0]) {
    node = unwrapExpression(node.arguments[0])
  }
  return node?.type === 'ObjectExpression' ? node : undefined
}

/** The value of `parameters.msw` in an object literal. */
export function mswValueOf(
  obj: E.ObjectExpression | undefined
): ESTreeNode | undefined {
  const parameters = obj && findObjectProperty(obj, 'parameters')
  if (parameters?.value.type !== 'ObjectExpression') return undefined
  return findObjectProperty(parameters.value, 'msw')?.value
}

// -------- handler extraction
//
// Returns the source of each expression to spread into `msw.use(...)`, or
// null if the shape isn't one we know how to migrate. The sources keep the
// comments that lead them, with continuation lines dedented.

export function extractHandlers(
  editor: SourceEditor,
  value: ESTreeNode
): string[] | null {
  // Legacy array form: `parameters: { msw: [...handlers] }`
  if (value.type === 'ArrayExpression') {
    return collectArrayElements(editor, value)
  }
  // Object form: `parameters: { msw: { handlers: ... } }`
  if (value.type === 'ObjectExpression') {
    const handlersProp = findObjectProperty(value, 'handlers')
    if (!handlersProp) return null
    const hv = handlersProp.value
    // `handlers: [h1, h2]`
    if (hv.type === 'ArrayExpression') return collectArrayElements(editor, hv)
    // `handlers: { name1: h, name2: [h, h] }` — flatten the values.
    if (hv.type === 'ObjectExpression') {
      const acc: string[] = []
      for (const prop of hv.properties) {
        // spread/method/accessor → unsupported
        if (!isPlainProperty(prop)) return null
        if (prop.value.type === 'ArrayExpression') {
          const elems = collectArrayElements(editor, prop.value)
          if (!elems) return null
          acc.push(...elems)
        } else if (isHandlerLikeExpression(prop.value)) {
          acc.push(nodeText(editor, prop.value))
        } else {
          return null
        }
      }
      return acc
    }
    return null
  }
  return null
}

/** Sources of an array's elements, or null if one is not handler-like. */
export function collectArrayElements(
  editor: SourceEditor,
  arr: E.ArrayExpression
): string[] | null {
  const list = arrayList(editor, arr)
  const acc: string[] = []
  for (let i = 0; i < arr.elements.length; i++) {
    const el = arr.elements[i]
    if (el === null) return null // sparse array
    // Spreads like `...sharedHandlers` flow through as written.
    if (el.type !== 'SpreadElement' && !isHandlerLikeExpression(el)) return null
    acc.push(itemText(editor, list, list.items[i]))
  }
  return acc
}

function isHandlerLikeExpression(node: ESTreeNode): boolean {
  // Anything that can sensibly be spread into `msw.use(...)` — calls,
  // identifiers, member expressions, conditionals, etc. Reject literal
  // primitives so we don't migrate something obviously wrong.
  return !(
    node.type === 'Literal' &&
    (typeof node.value === 'string' ||
      typeof node.value === 'number' ||
      typeof node.value === 'boolean')
  )
}

// -------- source builders
//
// New code is built as text indented from column zero; csf-tools and
// `reindent` move it to where it goes, leaving the content of string and
// template literals alone.

/** `({ msw }) => { msw.use(...handlers) }` */
export function beforeEachArrow(handlers: string[], step: string): string {
  const use = reindent(callText('msw.use', handlers, step), '', step)
  return `({ msw }) => {\n${step}${use}\n}`
}

/**
 * `callee(args)`: a single argument stays on the line of the call, more
 * arguments go one per line.
 */
export function callText(callee: string, args: string[], step: string): string {
  if (args.length === 0) return `${callee}()`
  if (args.length === 1 && !/^\s*\/[/*]/.test(args[0])) {
    return `${callee}(${args[0]})`
  }
  const lines = args.map((arg) => `${step}${reindent(arg, '', step)}`)
  return `${callee}(\n${lines.join(',\n')}\n)`
}

/** Source of a node with its continuation lines dedented. */
export function nodeText(editor: SourceEditor, node: ESTreeNode): string {
  return reindent(
    placeableTextOf(node),
    lineIndent(editor.code, node.start),
    ''
  )
}

/** `;` when the file ends its statements with one, so new ones match. */
export function semicolonFor(editor: SourceEditor): string {
  let withSemicolon = 0
  let without = 0
  for (const stmt of editor.program.body) {
    if (
      stmt.type !== 'ImportDeclaration' &&
      stmt.type !== 'ExpressionStatement' &&
      stmt.type !== 'VariableDeclaration' &&
      stmt.type !== 'ExportDefaultDeclaration'
    )
      continue
    if (editor.code[stmt.end - 1] === ';') withSemicolon++
    else without++
  }
  return without > withSemicolon ? '' : ';'
}

// -------- helpers

/** A `key: value` property: not a spread, method, getter or setter. */
function isPlainProperty(prop: E.ObjectPropertyKind): prop is E.ObjectProperty {
  return prop.type === 'Property' && prop.kind === 'init' && !prop.method
}

export function findObjectProperty(
  obj: E.ObjectExpression,
  name: string
): E.ObjectProperty | undefined {
  for (const prop of obj.properties) {
    if (isPlainProperty(prop) && staticKey(prop) === name) return prop
  }
  return undefined
}

// -------- CSF2
//
//   Foo.parameters = { msw: { handlers: [...] } }
//
// We can't inject `beforeEach` into a story object (the export is a
// function, not an object literal), so we emit a parallel sibling
// annotation: `Foo.beforeEach = ({ msw }) => { msw.use(...) }`.
//
// Storybook 11 no longer reads the v1 `Foo.story = { parameters }` form;
// `storybook migrate csf-2-to-3` lifts it out first.
function migrateCsf2Annotation(
  parsed: CsfFile,
  object: CsfObject,
  target: Extract<CsfObjectTarget, { kind: 'story-annotation' }>
): MigrationOutcome {
  if (target.annotation !== 'parameters') return 'noop'
  const editor = parsed._editor
  const stmt = findAnnotationStatement(parsed, target.localName)
  const parametersObj = stmt && annotationValue(stmt)
  const mswProp =
    parametersObj?.type === 'ObjectExpression'
      ? findObjectProperty(parametersObj, 'msw')
      : undefined
  if (!stmt || !mswProp) return 'noop'
  const parameters = parametersObj as E.ObjectExpression
  if (!read(parsed, () => object.get(MSW_PATH)).value) {
    return 'unrecognized-shape'
  }

  if (hasBeforeEachAnnotation(parsed, target.localName)) {
    return 'existing-before-each'
  }

  const handlers = extractHandlers(editor, mswProp.value)
  if (!handlers) return 'unrecognized-shape'

  const assignment =
    handlers.length > 0
      ? `${target.localName}.beforeEach = ${beforeEachArrow(handlers, editor.indent)}${
          editor.code[stmt.end - 1] === ';' ? ';' : semicolonFor(editor)
        }`
      : null

  if (parameters.properties.length === 1) {
    // `msw` was all there was: the annotation gives way to `beforeEach`.
    if (assignment) editor.edits.overwrite(stmt.start, stmt.end, assignment)
    else removeStatement(editor, stmt)
    editor.commit()
    return 'changed'
  }

  if (!object.remove(MSW_PATH).ok) return 'unrecognized-shape'
  if (assignment) {
    // A blank line sets the multi-line annotation apart from the statement.
    const after = findAnnotationStatement(parsed, target.localName)
    if (!after) return 'changed'
    editor.edits.appendLeft(
      statementSpan(editor, after).end,
      `\n\n${assignment}`
    )
    editor.commit()
  }
  return 'changed'
}

/** The property a top-level `<localName>.<property> = ...` assigns. */
function annotationKey(
  stmt: E.Directive | E.Statement,
  localName: string
): string | undefined {
  if (
    stmt.type !== 'ExpressionStatement' ||
    stmt.expression.type !== 'AssignmentExpression' ||
    stmt.expression.left.type !== 'MemberExpression'
  )
    return undefined
  const { object, property, computed } = stmt.expression.left
  if (object.type !== 'Identifier' || object.name !== localName)
    return undefined
  if (!computed && property.type === 'Identifier') return property.name
  return property.type === 'Literal' && typeof property.value === 'string'
    ? property.value
    : undefined
}

function annotationValue(stmt: E.ExpressionStatement): ESTreeNode {
  return unwrapExpression((stmt.expression as E.AssignmentExpression).right)
}

/** The top-level `<localName>.parameters = {...}` statement. */
function findAnnotationStatement(
  parsed: CsfFile,
  localName: string
): E.ExpressionStatement | undefined {
  return parsed._program.body.find(
    (stmt): stmt is E.ExpressionStatement =>
      annotationKey(stmt, localName) === 'parameters'
  )
}

/** Whether a `<localName>.beforeEach = ...` annotation exists anywhere at
 *  the top level of the file. */
function hasBeforeEachAnnotation(parsed: CsfFile, localName: string): boolean {
  return parsed._program.body.some(
    (stmt) => annotationKey(stmt, localName) === 'beforeEach'
  )
}
