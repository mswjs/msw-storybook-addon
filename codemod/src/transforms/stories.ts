// Story-file transform.
//
// Migrates `parameters.msw.handlers` (and its legacy shapes) into a
// `beforeEach({ msw }) { msw.use(...) }` annotation. Idempotent: a file
// that no longer carries `parameters.msw` is left untouched.
//
// Per the design discussion, we use the "recognised-shapes-only" rule
// (option C): the transform inspects `parameters.msw` and only rewrites
// when its shape is one of:
//   - `RequestHandler[]`           (legacy v0 array form)
//   - `{ handlers: RequestHandler[] }`
//   - `{ handlers: Record<string, RequestHandler | RequestHandler[]> }`
// Anything else (custom keys, dynamic values, etc.) is skipped and the
// caller is told to print a warning so the user can hand-migrate.
//
// CSF3 (story-as-object) and CSF2 (post-export `Story.parameters = ...`
// annotation) are both handled.

import { types as t } from 'storybook/internal/babel'
import { type CsfFile, loadCsf, printCsf } from 'storybook/internal/csf-tools'

export interface StoryTransformResult {
  /** Transformed source, or null when no changes were needed. */
  code: string | null
  /** Names of stories/files we refused to migrate because the
   *  `parameters.msw` shape wasn't recognisable. The CLI surfaces these
   *  as warnings so the user can hand-migrate. */
  skippedStories: string[]
}

export function transformStory(source: string): StoryTransformResult {
  const skipped: string[] = []
  let parsed: CsfFile
  try {
    parsed = loadCsf(source, { makeTitle: (title?: string) => title || 'default' }).parse()
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
    if (result === 'skipped') skipped.push(name)
  }
  if (parsed._metaPath) {
    const meta = resolveStoryObject(parsed, parsed._metaPath.node)
    if (meta) {
      const result = migrateMswOnObject(meta, 'meta')
      if (result === 'changed') changed = true
      if (result === 'skipped') skipped.push('meta')
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
    const assign = (stmt as t.ExpressionStatement).expression as t.AssignmentExpression
    const left = assign.left as t.MemberExpression
    const storyName = (left.object as t.Identifier).name
    const propName =
      (t.isIdentifier(left.property) && left.property.name) ||
      (t.isStringLiteral(left.property) && left.property.value) ||
      null
    if (propName !== 'parameters') continue
    if (!t.isObjectExpression(assign.right)) continue
    const result = migrateCsf2Annotation(parsed, stmt as t.ExpressionStatement, storyName, i)
    if (result === 'changed') changed = true
    if (result === 'skipped') skipped.push(storyName)
  }

  if (!changed) {
    return { code: null, skippedStories: skipped }
  }
  return { code: printCsf(parsed).code, skippedStories: skipped }
}

// -------- per-object migration

type MigrationOutcome = 'changed' | 'skipped' | 'noop'

function migrateMswOnObject(
  obj: t.ObjectExpression,
  storyName: string,
): MigrationOutcome {
  // Locate `parameters: { msw: ... }`.
  const parametersProp = findObjectProperty(obj, 'parameters')
  if (!parametersProp || !t.isObjectExpression(parametersProp.value)) return 'noop'
  const parameters = parametersProp.value
  const mswProp = findObjectProperty(parameters, 'msw')
  if (!mswProp) return 'noop'

  // Extract handlers list out of the recognised shapes.
  const extracted = extractHandlers(mswProp.value)
  if (!extracted) {
    // Unrecognised shape — leave the file alone for THIS story.
    return 'skipped'
  }

  // Refuse to silently overwrite an existing beforeEach. The user will
  // hand-merge; we'd rather skip than blow away their code. `beforeEach`
  // can appear as either a regular property (`beforeEach: () => {}`) or
  // the method shorthand (`beforeEach() {}`); check for both.
  if (hasAnyProperty(obj, 'beforeEach')) return 'skipped'

  // Build `beforeEach({ msw }) { msw.use(...handlers) }`.
  const beforeEachProp = buildBeforeEachProperty(extracted)
  // Insert it BEFORE parameters so the migrated file reads naturally.
  const insertIdx = obj.properties.indexOf(parametersProp)
  obj.properties.splice(insertIdx, 0, beforeEachProp)

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

function extractHandlers(value: t.Expression | t.PatternLike): t.Expression[] | null {
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
  return !t.isStringLiteral(node) && !t.isNumericLiteral(node) && !t.isBooleanLiteral(node)
}

// -------- AST builders

function buildBeforeEachProperty(handlers: t.Expression[]): t.ObjectMethod {
  // beforeEach({ msw }) { msw.use(...handlers) }
  const param = t.objectPattern([
    t.objectProperty(t.identifier('msw'), t.identifier('msw'), false, true),
  ])
  const callArgs: (t.Expression | t.SpreadElement)[] = handlers.map((h) =>
    t.isSpreadElement(h as unknown as t.Node) ? (h as unknown as t.SpreadElement) : (h as t.Expression),
  )
  const body = t.blockStatement([
    t.expressionStatement(
      t.callExpression(
        t.memberExpression(t.identifier('msw'), t.identifier('use')),
        callArgs,
      ),
    ),
  ])
  return t.objectMethod('method', t.identifier('beforeEach'), [param], body)
}

// -------- helpers

function findObjectProperty(
  obj: t.ObjectExpression,
  name: string,
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
function hasAnyProperty(obj: t.ObjectExpression, name: string): boolean {
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
    if (t.isTSSatisfiesExpression(init) || t.isTSAsExpression(init)) init = init.expression
    if (init && t.isObjectExpression(init)) return init
  } else if (t.isExportDefaultDeclaration(node)) {
    let init: t.Node | null | undefined = node.declaration
    if (init && (t.isTSSatisfiesExpression(init) || t.isTSAsExpression(init))) init = init.expression
    if (init && t.isObjectExpression(init)) return init
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
  node: t.Node,
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
  name: string,
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

// CSF2 annotation: `Foo.parameters = { msw: { handlers: [...] } }`.
//
// We can't inject `beforeEach` into a story object (the export is a
// function, not an object literal), so we emit a parallel sibling
// annotation: `Foo.beforeEach = ({ msw }) => { msw.use(...) }`.
function migrateCsf2Annotation(
  parsed: CsfFile,
  stmt: t.ExpressionStatement,
  storyName: string,
  stmtIndex: number,
): MigrationOutcome {
  const assign = stmt.expression as t.AssignmentExpression
  const parametersObj = assign.right as t.ObjectExpression
  const mswProp = findObjectProperty(parametersObj, 'msw')
  if (!mswProp) return 'noop'

  // Bail if a sibling `Foo.beforeEach = ...` annotation already exists.
  for (const other of parsed._ast.program.body) {
    if (!t.isExpressionStatement(other)) continue
    const e = other.expression
    if (!t.isAssignmentExpression(e)) continue
    if (!t.isMemberExpression(e.left)) continue
    if (!t.isIdentifier(e.left.object) || e.left.object.name !== storyName) continue
    const propName =
      (t.isIdentifier(e.left.property) && e.left.property.name) ||
      (t.isStringLiteral(e.left.property) && e.left.property.value) ||
      null
    if (propName === 'beforeEach') return 'skipped'
  }

  const handlers = extractHandlers(mswProp.value)
  if (!handlers) return 'skipped'

  // Build the sibling assignment.
  const param = t.objectPattern([
    t.objectProperty(t.identifier('msw'), t.identifier('msw'), false, true),
  ])
  const body = t.blockStatement([
    t.expressionStatement(
      t.callExpression(
        t.memberExpression(t.identifier('msw'), t.identifier('use')),
        handlers as (t.Expression | t.SpreadElement)[],
      ),
    ),
  ])
  const beforeEachAssign = t.expressionStatement(
    t.assignmentExpression(
      '=',
      t.memberExpression(t.identifier(storyName), t.identifier('beforeEach')),
      t.arrowFunctionExpression([param], body),
    ),
  )

  // Strip `msw` from the parameters object; drop the whole annotation
  // statement if that empties it.
  parametersObj.properties = parametersObj.properties.filter((p) => p !== mswProp)
  if (parametersObj.properties.length === 0) {
    parsed._ast.program.body.splice(stmtIndex, 1, beforeEachAssign)
  } else {
    parsed._ast.program.body.splice(stmtIndex + 1, 0, beforeEachAssign)
  }
  return 'changed'
}

function isCsf2Annotation(
  stmt: t.Statement,
  storyExports: Record<string, unknown>,
): boolean {
  if (!t.isExpressionStatement(stmt)) return false
  const expr = stmt.expression
  if (!t.isAssignmentExpression(expr)) return false
  if (!t.isMemberExpression(expr.left)) return false
  if (!t.isIdentifier(expr.left.object)) return false
  return Boolean(storyExports[expr.left.object.name])
}
