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
 * CSF3 (story-as-object) and CSF2 (post-export `Story.parameters = ...` annotation) are both handled.
 */

import { recast, types as t } from 'storybook/internal/babel'
import {
  babelParse,
  type CsfFile,
  loadCsf,
  printCsf
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

  // CSF3: meta export + each story export are object literals — walk them.
  for (const [name, decl] of Object.entries(parsed._storyExports)) {
    const obj = getStoryObject(decl)
    if (!obj) continue
    const result = migrateMswOnObject(obj, name)
    if (result === 'changed') changed = true
    else if (result !== 'noop') skipped.push({ story: name, reason: result })
  }
  // CSF3 metas are default-exported (`_metaPath`); CSF factory metas are
  // plain variables (`const meta = preview.meta({...})`) tracked only by
  // name in `_metaVariableName`.
  const metaNode =
    parsed._metaPath?.node ??
    (parsed._metaVariableName
      ? findVariableDeclarator(parsed, parsed._metaVariableName)
      : undefined)
  if (metaNode) {
    const meta = resolveStoryObject(parsed, metaNode)
    if (meta) {
      const result = migrateMswOnObject(meta, 'meta')
      if (result === 'changed') changed = true
      else if (result !== 'noop') skipped.push({ story: 'meta', reason: result })
    }
  }

  // CSF2: `Story.parameters = { msw: ... }` annotation statements at the
  // top level of the file. The RHS of that assignment IS the parameters
  // object — not a story object — so we need a different emit path that
  // produces a parallel `Story.beforeEach = ({ msw }) => { msw.use(...) }`
  // annotation rather than mutating an enclosing object literal.
  for (let i = parsed._ast.program.body.length - 1; i >= 0; i--) {
    const stmt = parsed._ast.program.body[i]
    if (!isCsf2Annotation(stmt, parsed._storyExports)) continue
    const assign = (stmt as t.ExpressionStatement)
      .expression as t.AssignmentExpression
    const left = assign.left as t.MemberExpression
    const storyName = (left.object as t.Identifier).name
    const propName =
      (t.isIdentifier(left.property) && left.property.name) ||
      (t.isStringLiteral(left.property) && left.property.value) ||
      null
    if (propName !== 'parameters' && propName !== 'story') continue
    if (!t.isObjectExpression(assign.right)) continue
    const result = migrateCsf2Annotation(
      parsed,
      stmt as t.ExpressionStatement,
      storyName,
      i,
      propName
    )
    if (result === 'changed') changed = true
    else if (result !== 'noop') skipped.push({ story: storyName, reason: result })
  }

  if (!changed) {
    return { code: null, skippedStories: skipped }
  }
  return { code: printCsf(parsed).code, skippedStories: skipped }
}

// -------- per-object migration

type MigrationOutcome = 'changed' | 'noop' | SkipReason

function migrateMswOnObject(
  obj: t.ObjectExpression,
  storyName: string
): MigrationOutcome {
  const parametersProp = findObjectProperty(obj, 'parameters')
  if (!parametersProp || !t.isObjectExpression(parametersProp.value))
    return 'noop'
  const parameters = parametersProp.value
  const mswProp = findObjectProperty(parameters, 'msw')
  if (!mswProp) return 'noop'

  const extracted = extractHandlers(mswProp.value)
  if (!extracted) {
    // Unrecognised shape — leave the file alone for THIS story.
    return 'unrecognized-shape'
  }

  // Refuse to silently overwrite an existing beforeEach. The user merges
  // the handlers into it themselves; we'd rather skip than blow away their
  // code. `beforeEach` can appear as either a regular property
  // (`beforeEach: () => {}`) or the method shorthand (`beforeEach() {}`);
  // check for both.
  if (extracted.length > 0 && hasAnyProperty(obj, 'beforeEach'))
    return 'existing-before-each'

  if (extracted.length > 0) {
    const beforeEachProp = buildBeforeEachProperty(extracted)
    // Inserted BEFORE parameters so the migrated file reads naturally.
    const insertIdx = obj.properties.indexOf(parametersProp)
    obj.properties.splice(insertIdx, 0, beforeEachProp)
  }
  // An empty handler list (`msw: []`) has nothing to carry over — the
  // parameter is simply dropped.

  // Strip `msw` from `parameters`; drop `parameters` itself if empty.
  parameters.properties = parameters.properties.filter((p) => p !== mswProp)
  if (parameters.properties.length === 0) {
    obj.properties = obj.properties.filter((p) => p !== parametersProp)
  }
  return 'changed'
}

// -------- handler extraction
//
// Returns an array of Expressions to spread into `msw.use(...)`, or null
// if the shape isn't one we know how to migrate.

export function extractHandlers(
  value: t.Expression | t.PatternLike
): t.Expression[] | null {
  // Legacy array form: `parameters: { msw: [...handlers] }`
  if (t.isArrayExpression(value)) {
    return collectArrayElements(value)
  }
  // Object form: `parameters: { msw: { handlers: ... } }`
  if (t.isObjectExpression(value)) {
    const handlersProp = findObjectProperty(value, 'handlers')
    if (!handlersProp) return null
    const hv = handlersProp.value
    // `handlers: [h1, h2]`
    if (t.isArrayExpression(hv)) return collectArrayElements(hv)
    // `handlers: { name1: h, name2: [h, h] }` — flatten the values.
    if (t.isObjectExpression(hv)) {
      const acc: t.Expression[] = []
      for (const prop of hv.properties) {
        if (!t.isObjectProperty(prop)) return null // spread/computed → unsupported
        if (t.isArrayExpression(prop.value)) {
          const elems = collectArrayElements(prop.value)
          if (!elems) return null
          acc.push(...elems)
        } else if (isHandlerLikeExpression(prop.value)) {
          acc.push(prop.value as t.Expression)
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

function collectArrayElements(arr: t.ArrayExpression): t.Expression[] | null {
  const acc: t.Expression[] = []
  for (const el of arr.elements) {
    if (el === null) return null // sparse array
    if (t.isSpreadElement(el)) {
      // Allow spreads like `...sharedHandlers` to flow through.
      acc.push(el as unknown as t.Expression)
      continue
    }
    if (!isHandlerLikeExpression(el)) return null
    acc.push(el as t.Expression)
  }
  return acc
}

function isHandlerLikeExpression(node: t.Node): boolean {
  // Anything that can sensibly be spread into `msw.use(...)` — calls,
  // identifiers, member expressions, conditionals, etc. Reject literal
  // primitives so we don't migrate something obviously wrong.
  return (
    !t.isStringLiteral(node) &&
    !t.isNumericLiteral(node) &&
    !t.isBooleanLiteral(node)
  )
}

// -------- AST builders
//
// The `beforeEach` shells are parsed from source templates WITH recast so
// they keep original tokens and print compactly (`beforeEach({ msw })`);
// nodes built via `t.*` get exploded across lines by recast's pretty
// printer. Only the `msw.use(...)` arguments are spliced in.

function parseTemplate(template: string): t.ObjectExpression {
  const parsed = recast.parse(template, {
    parser: { parse: (source: string) => babelParse(source) }
  }) as { program: t.Program }
  const stmt = parsed.program.body[0] as t.ExpressionStatement
  return stmt.expression as t.ObjectExpression
}

export function buildBeforeEachProperty(
  handlers: t.Expression[]
): t.ObjectMethod {
  // beforeEach({ msw }) { msw.use(...handlers) }
  const obj = parseTemplate(
    '({\n  beforeEach({ msw }) {\n    msw.use()\n  }\n})'
  )
  const method = obj.properties[0] as t.ObjectMethod
  const call = (method.body.body[0] as t.ExpressionStatement)
    .expression as t.CallExpression
  call.arguments.push(...(handlers as (t.Expression | t.SpreadElement)[]))
  return method
}

export function buildBeforeEachArrow(
  handlers: t.Expression[]
): t.ArrowFunctionExpression {
  // ({ msw }) => { msw.use(...handlers) }
  const obj = parseTemplate(
    '({\n  beforeEach: ({ msw }) => {\n    msw.use()\n  }\n})'
  )
  const prop = obj.properties[0] as t.ObjectProperty
  const arrow = prop.value as t.ArrowFunctionExpression
  const body = arrow.body as t.BlockStatement
  const call = (body.body[0] as t.ExpressionStatement)
    .expression as t.CallExpression
  call.arguments.push(...(handlers as (t.Expression | t.SpreadElement)[]))
  return arrow
}

// -------- helpers

export function findObjectProperty(
  obj: t.ObjectExpression,
  name: string
): t.ObjectProperty | undefined {
  for (const prop of obj.properties) {
    if (!t.isObjectProperty(prop)) continue
    const key = prop.key
    if (t.isIdentifier(key) && key.name === name) return prop
    if (t.isStringLiteral(key) && key.value === name) return prop
  }
  return undefined
}

// Like findObjectProperty but also matches `name() {}` method shorthand.
export function hasAnyProperty(obj: t.ObjectExpression, name: string): boolean {
  for (const prop of obj.properties) {
    if (t.isObjectProperty(prop) || t.isObjectMethod(prop)) {
      const key = prop.key
      if (t.isIdentifier(key) && key.name === name) return true
      if (t.isStringLiteral(key) && key.value === name) return true
    }
  }
  return false
}

function getStoryObject(node: t.Node): t.ObjectExpression | undefined {
  if (t.isVariableDeclarator(node)) {
    let init = node.init
    if (t.isTSSatisfiesExpression(init) || t.isTSAsExpression(init))
      init = init.expression
    if (init && t.isObjectExpression(init)) return init
    if (init) return unwrapFactoryCall(init)
  } else if (t.isExportDefaultDeclaration(node)) {
    let init: t.Node | null | undefined = node.declaration
    if (init && (t.isTSSatisfiesExpression(init) || t.isTSAsExpression(init)))
      init = init.expression
    if (init && t.isObjectExpression(init)) return init
  }
  return undefined
}

// CSF factories wrap the annotations object in a call:
// `preview.meta({...})` and `meta.story({...})`. An argument-less
// `meta.story()` has nothing to migrate.
function unwrapFactoryCall(node: t.Node): t.ObjectExpression | undefined {
  if (
    t.isCallExpression(node) &&
    t.isMemberExpression(node.callee) &&
    t.isIdentifier(node.callee.property) &&
    (node.callee.property.name === 'meta' ||
      node.callee.property.name === 'story') &&
    node.arguments[0] != null &&
    t.isObjectExpression(node.arguments[0])
  ) {
    return node.arguments[0]
  }
  return undefined
}

// Resolve a "story object" through one level of indirection.
//
// CSF3 meta is commonly:
//
//     const meta = { ... }
//     export default meta
//
// The CsfFile's `_metaPath` for that shape points at the
// `export default meta` declaration, whose `.declaration` is an
// `Identifier`. We follow the identifier back to its variable declarator
// in the file's top-level body and return the underlying ObjectExpression.
function resolveStoryObject(
  parsed: CsfFile,
  node: t.Node
): t.ObjectExpression | undefined {
  const direct = getStoryObject(node)
  if (direct) return direct
  if (t.isExportDefaultDeclaration(node)) {
    let decl: t.Node | null | undefined = node.declaration
    if (decl && (t.isTSSatisfiesExpression(decl) || t.isTSAsExpression(decl))) {
      decl = decl.expression
    }
    if (decl && t.isIdentifier(decl)) {
      const ref = findVariableDeclarator(parsed, decl.name)
      if (ref) return getStoryObject(ref)
    }
  }
  return undefined
}

function findVariableDeclarator(
  parsed: CsfFile,
  name: string
): t.VariableDeclarator | undefined {
  for (const stmt of parsed._ast.program.body) {
    const decl = t.isExportNamedDeclaration(stmt) ? stmt.declaration : stmt
    if (!decl || !t.isVariableDeclaration(decl)) continue
    for (const d of decl.declarations) {
      if (t.isIdentifier(d.id) && d.id.name === name) return d
    }
  }
  return undefined
}

// CSF2 annotations, in both historical forms:
//
//   Foo.parameters = { msw: { handlers: [...] } }
//   Foo.story = { parameters: { msw: { handlers: [...] } } }   (v1 style)
//
// We can't inject `beforeEach` into a story object (the export is a
// function, not an object literal), so we emit a parallel sibling
// annotation: `Foo.beforeEach = ({ msw }) => { msw.use(...) }`.
function migrateCsf2Annotation(
  parsed: CsfFile,
  stmt: t.ExpressionStatement,
  storyName: string,
  stmtIndex: number,
  form: 'parameters' | 'story'
): MigrationOutcome {
  const assign = stmt.expression as t.AssignmentExpression
  const container = assign.right as t.ObjectExpression

  let parametersObj: t.ObjectExpression
  let storyParametersProp: t.ObjectProperty | undefined
  if (form === 'parameters') {
    parametersObj = container
  } else {
    storyParametersProp = findObjectProperty(container, 'parameters')
    if (!storyParametersProp || !t.isObjectExpression(storyParametersProp.value)) {
      return 'noop'
    }
    parametersObj = storyParametersProp.value
  }

  const mswProp = findObjectProperty(parametersObj, 'msw')
  if (!mswProp) return 'noop'

  // csf-tools collects every `Foo.<key> = ...` assignment (and the keys of
  // a v1 `Foo.story = {...}` object) into `_storyAnnotations` — the
  // authoritative place to check for an existing `beforeEach`.
  if (parsed._storyAnnotations[storyName]?.beforeEach != null) {
    return 'existing-before-each'
  }

  const handlers = extractHandlers(mswProp.value)
  if (!handlers) return 'unrecognized-shape'

  // Strip `msw` from the parameters object, then unwind empty containers:
  // an emptied `parameters` comes off the story object; an emptied
  // statement is dropped. An empty handler list has nothing to carry over,
  // so no `beforeEach` sibling is emitted for it.
  parametersObj.properties = parametersObj.properties.filter(
    (p) => p !== mswProp
  )
  if (
    storyParametersProp &&
    parametersObj.properties.length === 0
  ) {
    container.properties = container.properties.filter(
      (p) => p !== storyParametersProp
    )
  }
  const statementEmptied = container.properties.length === 0

  if (handlers.length === 0) {
    if (statementEmptied) {
      parsed._ast.program.body.splice(stmtIndex, 1)
    }
    return 'changed'
  }

  const beforeEachAssign = t.expressionStatement(
    t.assignmentExpression(
      '=',
      t.memberExpression(t.identifier(storyName), t.identifier('beforeEach')),
      buildBeforeEachArrow(handlers)
    )
  )

  if (statementEmptied) {
    parsed._ast.program.body.splice(stmtIndex, 1, beforeEachAssign)
  } else {
    parsed._ast.program.body.splice(stmtIndex + 1, 0, beforeEachAssign)
  }
  return 'changed'
}

function isCsf2Annotation(
  stmt: t.Statement,
  storyExports: Record<string, unknown>
): boolean {
  if (!t.isExpressionStatement(stmt)) return false
  const expr = stmt.expression
  if (!t.isAssignmentExpression(expr)) return false
  if (!t.isMemberExpression(expr.left)) return false
  if (!t.isIdentifier(expr.left.object)) return false
  return Boolean(storyExports[expr.left.object.name])
}
