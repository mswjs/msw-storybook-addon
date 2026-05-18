// `.storybook/main.{js,ts}` transform.
//
// Single responsibility: ensure `'msw-storybook-addon'` is in the
// `addons` array of the exported Storybook config. Required for the CSF3
// path — the addon's `./preview` annotations are auto-loaded by Storybook
// only when the package name appears in `main.ts addons`.
//
// Idempotent: if the entry already exists (as a bare string OR as the
// object form `{ name: 'msw-storybook-addon', options: {...} }`), the
// file isn't touched.

import { types as t } from 'storybook/internal/babel'
import { type ConfigFile, loadConfig, printConfig } from 'storybook/internal/csf-tools'

const ADDON_PACKAGE = 'msw-storybook-addon'

export function transformMain(source: string): string | null {
  let parsed: ConfigFile
  try {
    parsed = loadConfig(source).parse()
  } catch {
    return null
  }

  const config = getConfigObject(parsed)
  if (!config) return null

  const addonsProp = findProperty(config, 'addons')

  // No `addons` key → add one with our addon.
  if (!addonsProp) {
    config.properties.push(
      t.objectProperty(
        t.identifier('addons'),
        t.arrayExpression([t.stringLiteral(ADDON_PACKAGE)]),
      ),
    )
    return printConfig(parsed).code
  }

  if (!t.isArrayExpression(addonsProp.value)) {
    // `addons` exists but isn't an array literal (e.g. a spread of a
    // shared list). Refuse rather than guess.
    return null
  }

  if (alreadyHasAddon(addonsProp.value)) {
    return null
  }
  addonsProp.value.elements.push(t.stringLiteral(ADDON_PACKAGE))
  return printConfig(parsed).code
}

function alreadyHasAddon(arr: t.ArrayExpression): boolean {
  for (const el of arr.elements) {
    if (!el) continue
    if (t.isStringLiteral(el) && el.value === ADDON_PACKAGE) return true
    if (t.isObjectExpression(el)) {
      const name = findProperty(el, 'name')
      if (name && t.isStringLiteral(name.value) && name.value.value === ADDON_PACKAGE) {
        return true
      }
    }
  }
  return false
}

function getConfigObject(parsed: ConfigFile): t.ObjectExpression | null {
  const exports = parsed._exportsObject
  if (exports && t.isObjectExpression(exports)) return exports
  return null
}

function findProperty(obj: t.ObjectExpression, name: string): t.ObjectProperty | undefined {
  for (const prop of obj.properties) {
    if (!t.isObjectProperty(prop)) continue
    const key = prop.key
    if (t.isIdentifier(key) && key.name === name) return prop
    if (t.isStringLiteral(key) && key.value === name) return prop
  }
  return undefined
}
