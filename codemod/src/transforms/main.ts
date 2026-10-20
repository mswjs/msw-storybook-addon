/**
 * `.storybook/main.{js,ts}` transform.
 *
 * Single responsibility: ensure `'msw-storybook-addon'` is in the
 * `addons` array of the exported Storybook config. The registration is
 * what `npx storybook automigrate csf-factories` reads later to wire the
 * addon into a CSF Next preview.
 *
 * Idempotent: if the entry already exists — as a bare string, a
 * resolver-wrapped call (`getAbsolutePath('msw-storybook-addon')`), or
 * the object form `{ name, options }` — the file isn't touched.
 */

import * as t from '@babel/types'
import { findConfigExports, parse, print, propKey, stringLiteral } from './ast'

const ADDON_PACKAGE = 'msw-storybook-addon'

export function transformMain(source: string): string | null {
  let ast: t.File
  try {
    ast = parse(source)
  } catch {
    return null
  }

  // Resolves plain objects, `defineMain({...})`-wrapped configs and
  // variable-declared default exports alike.
  const { exportsObject, exports } = findConfigExports(ast)
  if (!exportsObject) return null

  const addonsNode = exports.addons

  // An `addons` field the parser cannot follow (a method or a getter) is
  // left alone rather than shadowed by a second `addons` key.
  if (
    !addonsNode &&
    exportsObject.properties.some((p) => propKey(p) === 'addons')
  ) {
    return null
  }

  if (!addonsNode) {
    exportsObject.properties.push(
      t.objectProperty(
        t.identifier('addons'),
        t.arrayExpression([stringLiteral(ast, source, ADDON_PACKAGE)])
      )
    )
    return print(ast)
  }

  if (!t.isArrayExpression(addonsNode)) {
    // `addons` exists but isn't an array literal (e.g. a spread of a
    // shared list). Refuse rather than guess.
    return null
  }

  if (alreadyHasAddon(addonsNode)) {
    return null
  }

  // Follow the project's convention: pnpm setups commonly wrap addon
  // entries in a resolver call — `addons: [getAbsolutePath('addon-name')]`.
  // A plain string would not resolve there, so the new entry is wrapped
  // with the same function.
  const wrapper = detectWrapperName(addonsNode)
  const name = stringLiteral(ast, source, ADDON_PACKAGE)
  addonsNode.elements.push(
    wrapper ? t.callExpression(t.identifier(wrapper), [name]) : name
  )
  return print(ast)
}

/** Unwrap an `addons` array entry to the addon package name it refers to.
 *  Handles the bare string, the wrapped call (`getAbsolutePath('pkg')` or
 *  any single-string-argument resolver), and the object form — with either
 *  a string or a wrapped call as `name`. */
function resolveAddonName(el: t.Node): string | null {
  if (t.isStringLiteral(el)) return el.value
  if (
    t.isCallExpression(el) &&
    t.isIdentifier(el.callee) &&
    el.arguments.length === 1 &&
    t.isStringLiteral(el.arguments[0])
  ) {
    return el.arguments[0].value
  }
  if (t.isObjectExpression(el)) {
    const name = findProperty(el, 'name')
    if (name) return resolveAddonName(name.value)
  }
  return null
}

function alreadyHasAddon(arr: t.ArrayExpression): boolean {
  return arr.elements.some(
    (el) => el != null && resolveAddonName(el) === ADDON_PACKAGE
  )
}

/** The resolver function name used by existing entries, if any. */
function detectWrapperName(arr: t.ArrayExpression): string | null {
  for (const el of arr.elements) {
    if (
      el &&
      t.isCallExpression(el) &&
      t.isIdentifier(el.callee) &&
      el.arguments.length === 1 &&
      t.isStringLiteral(el.arguments[0])
    ) {
      return el.callee.name
    }
  }
  return null
}

function findProperty(
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
