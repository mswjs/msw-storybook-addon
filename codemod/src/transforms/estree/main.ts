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

import {
  type ConfigFile,
  type ESTree as E,
  type ESTreeNode,
  isStringLiteral,
  loadConfig,
  objectProperty,
  parseExpression,
  printConfig,
  printString
} from 'storybook/internal/csf-tools'

const ADDON_PACKAGE = 'msw-storybook-addon'

export function transformMain(source: string): string | null {
  let parsed: ConfigFile
  try {
    parsed = loadConfig(source).parse()
  } catch {
    return null
  }

  // `addons` as written, through local constants. Unlike `inspectList`,
  // this also reads a config csf-tools will not edit (a binding used
  // elsewhere too, a call-wrapped object, a spread after the field), so an
  // addon registered there is still found; adding one is refused below.
  const addonsNode = parsed.getFieldNode(['addons'])

  // A config of named exports is left alone. A default export csf-tools
  // cannot add to, such as `makeConfig()`, is reported below.
  if (!parsed.node && !parsed.hasDefaultExport) return null

  if (addonsNode && addonsNode.type !== 'ArrayExpression') {
    // `addons` exists but isn't an array literal (e.g. an imported list,
    // or a method). Refuse rather than guess.
    return null
  }

  if (addonsNode && alreadyHasAddon(addonsNode)) {
    return null
  }

  // Follow the project's convention: pnpm setups commonly wrap addon
  // entries in a resolver call — `addons: [getAbsolutePath('addon-name')]`.
  // A plain string would not resolve there, so the new entry is wrapped
  // with the same function.
  const wrapper = addonsNode && detectWrapperName(addonsNode)
  const result = parsed.append(
    ['addons'],
    wrapper
      ? parseExpression(
          `${wrapper}(${printString(ADDON_PACKAGE, parsed.editor.quote)})`
        )
      : ADDON_PACKAGE
  )
  // csf-tools refuses an `addons` it cannot edit safely, such as one next
  // to a spread. The CLI lists the error, so the user adds it by hand.
  if (!result.ok) {
    throw new Error(
      `Could not add '${ADDON_PACKAGE}' to \`addons\` (${result.diagnostic.message}); add it yourself.`
    )
  }
  return printConfig(parsed).code
}

/** `fn('pkg')`: a call of a plain function with one string argument. */
function isResolverCall(el: ESTreeNode): el is E.CallExpression & {
  callee: E.IdentifierReference
  arguments: [E.StringLiteral]
} {
  return (
    el.type === 'CallExpression' &&
    el.callee.type === 'Identifier' &&
    el.arguments.length === 1 &&
    isStringLiteral(el.arguments[0])
  )
}

/** Unwrap an `addons` array entry to the addon package name it refers to.
 *  Handles the bare string, the wrapped call (`getAbsolutePath('pkg')` or
 *  any single-string-argument resolver), and the object form — with either
 *  a string or a wrapped call as `name`. */
function resolveAddonName(el: ESTreeNode): string | null {
  if (isStringLiteral(el)) return el.value
  if (isResolverCall(el)) return el.arguments[0].value
  if (el.type === 'ObjectExpression') {
    const name = objectProperty(el, 'name')
    if (name) return resolveAddonName(name.value)
  }
  return null
}

function alreadyHasAddon(arr: E.ArrayExpression): boolean {
  return arr.elements.some(
    (el) => el != null && resolveAddonName(el) === ADDON_PACKAGE
  )
}

/** The resolver function name used by existing entries, if any. */
function detectWrapperName(arr: E.ArrayExpression): string | null {
  for (const el of arr.elements) {
    if (el && isResolverCall(el)) {
      return el.callee.name
    }
  }
  return null
}
