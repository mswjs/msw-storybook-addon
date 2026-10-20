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
  parseExpression,
  printConfig,
  printString,
  staticKey
} from 'storybook/internal/csf-tools'

const ADDON_PACKAGE = 'msw-storybook-addon'

export function transformMain(source: string): string | null {
  let parsed: ConfigFile
  try {
    parsed = loadConfig(source).parse()
  } catch {
    return null
  }

  // The parser resolves plain objects, `defineMain({...})`-wrapped configs
  // and variable-declared default exports alike.
  if (!parsed._exportsObject) return null

  const addonsNode = parsed.getFieldNode(['addons'])

  if (addonsNode && addonsNode.type !== 'ArrayExpression') {
    // `addons` exists but isn't an array literal (e.g. a spread of a
    // shared list, or a method). Refuse rather than guess.
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
  if (wrapper) {
    const name = printString(ADDON_PACKAGE, parsed._editor.quote)
    parsed.appendNodeToArray(['addons'], parseExpression(`${wrapper}(${name})`))
  } else {
    // Creates `addons` when it is missing.
    parsed.appendValueToArray(['addons'], ADDON_PACKAGE)
  }
  // An `addons` field csf-tools cannot edit (next to a spread, say) is
  // reported as a diagnostic instead of being written. The CLI lists the
  // error, so the user registers the addon by hand.
  const [diagnostic] = parsed.mutationDiagnostics
  if (diagnostic) {
    throw new Error(
      `Could not add '${ADDON_PACKAGE}' to \`addons\` (${diagnostic.message}); add it yourself.`
    )
  }
  return printConfig(parsed).code
}

/** `fn('pkg')`: a call of a plain function with one string argument. */
function isResolverCall(
  el: ESTreeNode
): el is E.CallExpression & { callee: E.IdentifierReference } {
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
  if (isResolverCall(el)) {
    return (el.arguments[0] as E.StringLiteral).value
  }
  if (el.type === 'ObjectExpression') {
    const name = el.properties.find(
      (prop): prop is E.ObjectProperty =>
        prop.type === 'Property' &&
        prop.kind === 'init' &&
        !prop.method &&
        staticKey(prop) === 'name'
    )
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
