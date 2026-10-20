/**
 * Parsing and printing for the transforms.
 *
 * The codemod brings its own Babel parser and recast printer instead of
 * reading Storybook's ASTs: Storybook 10 exposes Babel nodes from
 * `storybook/internal/csf-tools` and ships Babel itself, Storybook 11
 * exposes ESTree nodes and ships no Babel at all. With its own AST the
 * codemod works the same on both.
 *
 * The options match the ones Storybook 10 parsed and printed with, so the
 * output matches what the codemod printed with Storybook's Babel.
 */

import { parse as babelParse, type ParserOptions } from '@babel/parser'
import * as t from '@babel/types'
import * as recast from 'recast'

const parserOptions: ParserOptions = {
  sourceType: 'module',
  plugins: ['jsx', 'decorators-legacy', 'classProperties'],
  tokens: true
}

function parseWithFlowOrTypescript(source: string) {
  const language = /^\s*\/\/\s*@flow/.test(source) ? 'flow' : 'typescript'
  return babelParse(source, {
    ...parserOptions,
    plugins: [...(parserOptions.plugins ?? []), language]
  })
}

/** Parse a module for recast, so unchanged code prints as written. */
export function parse(source: string): t.File {
  return recast.parse(source, {
    parser: { parse: parseWithFlowOrTypescript }
  }) as t.File
}

export function print(ast: t.Node): string {
  return recast.print(ast).code
}

// -------- config files (`.storybook/main.*`, `.storybook/preview.*`)

export interface ConfigExports {
  /** The exported config object: the default export, `module.exports`, or
   *  the object passed to `definePreview(...)`. */
  exportsObject?: t.ObjectExpression
  /** Exported fields by name, identifiers resolved to their initializer. */
  exports: Record<string, t.Node>
}

export const propKey = (p: t.Node): string | null =>
  t.isObjectProperty(p) || t.isObjectMethod(p)
    ? t.isIdentifier(p.key)
      ? p.key.name
      : t.isStringLiteral(p.key)
        ? p.key.value
        : null
    : null

function unwrap(node: t.Node | null | undefined): t.Node | null | undefined {
  return t.isTSAsExpression(node) || t.isTSSatisfiesExpression(node)
    ? unwrap(node.expression)
    : node
}

function findVarDeclarator(
  name: string,
  program: t.Program
): t.VariableDeclarator | undefined {
  for (const stmt of program.body) {
    const decl = t.isExportNamedDeclaration(stmt) ? stmt.declaration : stmt
    if (!t.isVariableDeclaration(decl)) continue
    for (const d of decl.declarations) {
      if (t.isIdentifier(d.id) && d.id.name === name) return d
    }
  }
  return undefined
}

/**
 * Find the exported config the way Storybook 10's `ConfigFile#parse` does:
 * `export default {...}`, call-wrapped (`defineMain({...})`) and
 * variable-declared default exports, `module.exports = {...}`, and
 * `definePreview({...})` calls.
 */
export function findConfigExports(ast: t.File): ConfigExports {
  const program = ast.program
  const out: ConfigExports = { exports: {} }

  const resolve = (node: t.Node | null | undefined, topLevel: boolean) => {
    const decl = unwrap(node)
    if (t.isIdentifier(decl) && topLevel) {
      const init = findVarDeclarator(decl.name, program)?.init
      return init ? unwrap(init) : decl
    }
    return decl
  }

  const useExportsObject = (obj: t.ObjectExpression, topLevel: boolean) => {
    out.exportsObject = obj
    for (const p of obj.properties) {
      const name = propKey(p)
      const value = resolve((p as t.ObjectProperty).value, topLevel)
      if (name && value) out.exports[name] = value
    }
  }

  recast.types.visit(ast, {
    visitExportDefaultDeclaration(path) {
      const topLevel = t.isProgram(path.parent?.node)
      let decl = resolve(path.node.declaration as t.Node, topLevel)
      while (t.isCallExpression(decl)) {
        if (t.isObjectExpression(decl.arguments[0])) {
          decl = decl.arguments[0]
          break
        } else if (
          t.isMemberExpression(decl.callee) &&
          t.isCallExpression(decl.callee.object)
        ) {
          decl = decl.callee.object
        } else {
          break
        }
      }
      if (t.isObjectExpression(decl)) useExportsObject(decl, true)
      this.traverse(path)
    },
    visitExportNamedDeclaration(path) {
      const node = path.node as t.ExportNamedDeclaration
      if (t.isVariableDeclaration(node.declaration)) {
        for (const d of node.declaration.declarations) {
          const value = resolve(d.init, true)
          if (t.isIdentifier(d.id) && value) out.exports[d.id.name] = value
        }
      } else if (!node.declaration) {
        for (const spec of node.specifiers) {
          if (
            !t.isExportSpecifier(spec) ||
            !t.isIdentifier(spec.local) ||
            !t.isIdentifier(spec.exported)
          )
            continue
          const d = findVarDeclarator(spec.local.name, program)
          const value = d && resolve(d.init, true)
          if (value) out.exports[spec.exported.name] = value
        }
      }
      this.traverse(path)
    },
    visitExpressionStatement(path) {
      const expr = path.node.expression as t.Expression
      if (
        t.isAssignmentExpression(expr) &&
        expr.operator === '=' &&
        t.isMemberExpression(expr.left) &&
        t.isIdentifier(expr.left.object, { name: 'module' }) &&
        t.isIdentifier(expr.left.property, { name: 'exports' })
      ) {
        const topLevel = t.isProgram(path.parent?.node)
        const obj = resolve(expr.right, topLevel)
        if (t.isObjectExpression(obj)) useExportsObject(obj, topLevel)
      }
      this.traverse(path)
    },
    visitCallExpression(path) {
      const node = path.node as t.CallExpression
      if (
        t.isIdentifier(node.callee, { name: 'definePreview' }) &&
        node.arguments.length === 1 &&
        t.isObjectExpression(node.arguments[0])
      ) {
        useExportsObject(node.arguments[0], true)
      }
      this.traverse(path)
    }
  })
  return out
}

/** Whether the preview uses CSF Next: it imports `definePreview` from a
 *  Storybook package. */
export function isCsfFactoryPreview(ast: t.File): boolean {
  return ast.program.body.some(
    (node) =>
      t.isImportDeclaration(node) &&
      node.source.value.includes('storybook') &&
      node.specifiers.some(
        (specifier) =>
          t.isImportSpecifier(specifier) &&
          t.isIdentifier(specifier.imported, { name: 'definePreview' })
      )
  )
}

/**
 * A string literal in the quote style of the file, as Storybook 10's
 * `ConfigFile#valueToNode` chose it: single quotes when they outnumber
 * double quotes among the first 500 tokens. It is parsed rather than
 * built, so recast prints it as written here.
 */
export function stringLiteral(
  ast: t.File,
  source: string,
  value: string
): t.StringLiteral {
  const counts = { "'": 0, '"': 0 }
  const tokens = ((ast as { tokens?: unknown[] }).tokens ?? []) as {
    type?: { label?: string }
    start: number
  }[]
  for (const token of tokens.slice(0, 500)) {
    const quote = source[token.start]
    if (token.type?.label === 'string' && (quote === "'" || quote === '"')) {
      counts[quote]++
    }
  }
  const json = JSON.stringify(value)
  const raw =
    counts["'"] > counts['"']
      ? `'${json.slice(1, -1).replaceAll('\\"', '"').replaceAll("'", "\\'")}'`
      : json
  const decl = parse(`const __x = ${raw}`).program
    .body[0] as t.VariableDeclaration
  return decl.declarations[0].init as t.StringLiteral
}
