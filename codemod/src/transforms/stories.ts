/**
 * Story-file transform.
 * Migrates `parameters.msw.handlers` (and its legacy shapes) into a
 * `beforeEach: ({ msw }) => { msw.use(...) }` annotation. Idempotent: a
 * file that no longer carries `parameters.msw` is left untouched.
 * Only shapes the transform can prove safe are rewritten:
 *   - `RequestHandler[]` (legacy array form)
 *   - `{ handlers: RequestHandler[] }`
 *   - `{ handlers: Record<string, RequestHandler | RequestHandler[]> }`
 * Anything else (custom keys, dynamic values, etc.) is skipped while
 * the user gets a warning to migrate by hand.
 * Metas and stories in CSF3, CSF factories and CSF2 (post-export
 * `Story.parameters = ...` annotations) are handled.
 */

import {
  arrayList,
  type CsfFile,
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
  SourceEditor,
  staticKey,
  textOf
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
  let parsed: CsfFile
  try {
    parsed = loadCsf(source, {
      makeTitle: (title?: string) => title || 'default'
    }).parse()
  } catch {
    // Not parseable as CSF — leave alone.
    return { code: null, skippedStories: [] }
  }

  const skipped: SkippedStory[] = []
  for (const object of parsed.objects()) {
    const reason = migrateObject(parsed, object)
    if (reason) skipped.push({ story: storyName(object.target), reason })
  }
  return {
    code: parsed.changed ? printCsf(parsed).code : null,
    skippedStories: skipped
  }
}

function storyName(target: CsfObjectTarget): string {
  return 'exportName' in target ? target.exportName : 'meta'
}

/**
 * Migrate a meta or story: a CSF3 or CSF factory object literal, or a CSF2
 * story whose `Story.parameters = ...` and `Story.beforeEach = ...`
 * assignments are its fields. Returns why it was skipped, if it was.
 */
function migrateObject(
  parsed: CsfFile,
  object: CsfObject
): SkipReason | undefined {
  const msw = object.inspect(MSW_PATH)
  // An object literal counts as carrying `parameters.msw` when it writes
  // it out itself; one it could only get from a spread is not ours to touch.
  const written = object.node
    ? mswValueOf(object.node) != null
    : msw.kind !== 'missing'
  if (!written) return undefined
  if (msw.kind !== 'value') return 'unrecognized-shape'

  const handlers = handlersOf(msw.node)
  if (!handlers) return 'unrecognized-shape'

  if (handlers.length > 0) {
    // An existing `beforeEach` is not overwritten: the user merges the
    // handlers into it. A spread could hold one as well.
    const beforeEach = object.inspect(['beforeEach'])
    if (beforeEach.kind === 'unreadable') return 'unrecognized-shape'
    if (beforeEach.kind === 'value') return 'existing-before-each'
  }

  // Removing `msw` also removes a `parameters` it leaves empty, and with it
  // a CSF2 `Story.parameters = ...` statement. An empty handler list
  // (`msw: []`) has nothing to carry over.
  const migrated = parsed.transaction(() => {
    object.remove(MSW_PATH)
    if (handlers.length > 0) {
      object.set(
        ['beforeEach'],
        parseExpression(beforeEachArrow(handlers, parsed._editor.indent))
      )
    }
  })
  return migrated ? undefined : 'unrecognized-shape'
}

/** The value of `parameters.msw` written in an object literal. */
export function mswValueOf(
  obj: E.ObjectExpression | undefined
): ESTreeNode | undefined {
  const parameters = findObjectProperty(obj, 'parameters')?.value
  if (parameters?.type !== 'ObjectExpression') return undefined
  return findObjectProperty(parameters, 'msw')?.value
}

/**
 * The source of each expression to spread into `msw.use(...)`, or null if
 * the shape isn't one we know how to migrate. Array elements keep the
 * comments that lead them; continuation lines are dedented.
 *
 * `inspect` returns a copy of the value, so it is parsed into an editor of
 * its own to read the comments around its elements.
 */
export function handlersOf(value: ESTreeNode): string[] | null {
  const editor = new SourceEditor(`(${textOf(value)})`)
  const [statement] = editor.program.body as [E.ExpressionStatement]
  return extractHandlers(editor, statement.expression)
}

function extractHandlers(
  editor: SourceEditor,
  value: ESTreeNode
): string[] | null {
  // Legacy array form: `parameters: { msw: [...handlers] }`
  if (value.type === 'ArrayExpression') return arrayHandlers(editor, value)
  if (value.type !== 'ObjectExpression') return null

  // Object form: `parameters: { msw: { handlers: ... } }`
  const handlers = findObjectProperty(value, 'handlers')?.value
  if (handlers?.type === 'ArrayExpression') {
    return arrayHandlers(editor, handlers)
  }
  if (handlers?.type !== 'ObjectExpression') return null

  // `handlers: { name1: h, name2: [h, h] }` — flatten the values.
  const out: string[] = []
  for (const prop of handlers.properties) {
    if (!isPlainProperty(prop)) return null
    if (prop.value.type === 'ArrayExpression') {
      const elements = arrayHandlers(editor, prop.value)
      if (!elements) return null
      out.push(...elements)
    } else if (isHandlerLike(prop.value)) {
      out.push(nodeText(editor, prop.value))
    } else {
      return null
    }
  }
  return out
}

/** Sources of an array's elements, or null if one is not handler-like. */
function arrayHandlers(
  editor: SourceEditor,
  arr: E.ArrayExpression
): string[] | null {
  // Spreads like `...sharedHandlers` flow through as written.
  const handlerLike = arr.elements.every(
    (el) => el != null && (el.type === 'SpreadElement' || isHandlerLike(el))
  )
  if (!handlerLike) return null
  const list = arrayList(editor, arr)
  return list.items.map((item) => itemText(editor, list, item))
}

/**
 * Anything that can sensibly be spread into `msw.use(...)`: calls,
 * identifiers, member expressions, conditionals, etc. Literal primitives
 * are rejected so we don't migrate something obviously wrong.
 */
function isHandlerLike(node: ESTreeNode): boolean {
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
function nodeText(editor: SourceEditor, node: ESTreeNode): string {
  return reindent(
    placeableTextOf(node),
    lineIndent(editor.code, node.start),
    ''
  )
}

/** A `key: value` property: not a spread, method, getter or setter. */
function isPlainProperty(prop: E.ObjectPropertyKind): prop is E.ObjectProperty {
  return prop.type === 'Property' && prop.kind === 'init' && !prop.method
}

export function findObjectProperty(
  obj: E.ObjectExpression | undefined,
  name: string
): E.ObjectProperty | undefined {
  return obj?.properties.find(
    (prop): prop is E.ObjectProperty =>
      isPlainProperty(prop) && staticKey(prop) === name
  )
}
