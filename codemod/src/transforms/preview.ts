// `.storybook/preview.{js,ts,jsx,tsx}` transform.
//
// Responsibilities:
//   1. Drop the legacy `mswLoader` / `mswDecorator` wiring — their named
//      imports and any `loaders`/`decorators` references inside the preview
//      default export. The `initialize` call itself is left strictly alone
//      so users' real-world configs (custom StartOptions, function-form
//      `onUnhandledRequest`, return-value destructuring, etc.) keep working.
//   2. Move the `initialize` import to the `msw-storybook-addon/csf3`
//      subpath (it's the CSF 3.0 customization entry point).
//   3. If the user is on CSF factories — `definePreview({ addons: [...] })`
//      — make sure `mswAddon()` is in the addons array, importing the
//      default export if not already imported.
//
// Idempotent: running twice produces the same result and no spurious diff.

import { types as t } from 'storybook/internal/babel'
import { type ConfigFile, loadConfig, printConfig } from 'storybook/internal/csf-tools'

const ADDON_PACKAGE = 'msw-storybook-addon'
const CSF3_SUBPATH = 'msw-storybook-addon/csf3'

function importedName(spec: t.ImportSpecifier): string | null {
  const imported = spec.imported
  return (
    (t.isIdentifier(imported) && imported.name) ||
    (t.isStringLiteral(imported) && imported.value) ||
    null
  )
}

export function transformPreview(source: string): string | null {
  let parsed: ConfigFile
  try {
    parsed = loadConfig(source).parse()
  } catch {
    return null
  }

  let changed = false

  // -- 1. Drop `mswLoader` / `mswDecorator` from imports.
  for (const stmt of parsed._ast.program.body) {
    if (!t.isImportDeclaration(stmt)) continue
    if (stmt.source.value !== ADDON_PACKAGE) continue
    const before = stmt.specifiers.length
    stmt.specifiers = stmt.specifiers.filter((spec) => {
      if (!t.isImportSpecifier(spec)) return true
      const name = importedName(spec)
      return name !== 'mswLoader' && name !== 'mswDecorator'
    })
    if (stmt.specifiers.length !== before) changed = true
  }

  // -- 1b. Move the `initialize` import to the `/csf3` subpath.
  if (moveInitializeToCsf3(parsed)) changed = true

  // Drop any import declaration that lost all its specifiers AND wasn't
  // a side-effect import to begin with.
  parsed._ast.program.body = parsed._ast.program.body.filter((stmt) => {
    if (!t.isImportDeclaration(stmt)) return true
    if (stmt.source.value !== ADDON_PACKAGE) return true
    if (stmt.specifiers.length === 0) {
      // Side-effect imports don't carry named specifiers, so an emptied
      // declaration here always came from removing `mswLoader`/
      // `mswDecorator` (initialize is retargeted, never emptied). Drop it.
      changed = true
      return false
    }
    return true
  })

  // -- 2. Walk the preview default export object (or the config inside
  //   `definePreview(...)`) and drop `loaders`/`decorators` references.
  const previewObj = getPreviewConfigObject(parsed)
  if (previewObj) {
    if (stripMswRef(previewObj, 'loaders', 'mswLoader')) changed = true
    if (stripMswRef(previewObj, 'decorators', 'mswDecorator')) changed = true

    // -- 3. Factories path: ensure mswAddon() is in `addons: [...]`.
    if (isFactoriesPreview(parsed)) {
      if (ensureFactoriesAddonRegistered(parsed, previewObj)) changed = true
    }
  }

  return changed ? printConfig(parsed).code : null
}

// -------- discover the preview config object
//
// CSF3 plain object:        export default { ... }
// CSF factories:            export default definePreview({ ... })
// Variable + default:       const preview = {...}; export default preview;

function getPreviewConfigObject(parsed: ConfigFile): t.ObjectExpression | null {
  const exports = parsed._exportsObject
  if (exports && t.isObjectExpression(exports)) return exports
  // Look for `export default definePreview({...})` directly.
  for (const stmt of parsed._ast.program.body) {
    if (!t.isExportDefaultDeclaration(stmt)) continue
    let decl: t.Node = stmt.declaration
    if (t.isTSSatisfiesExpression(decl) || t.isTSAsExpression(decl)) decl = decl.expression
    if (
      t.isCallExpression(decl) &&
      t.isIdentifier(decl.callee) &&
      decl.callee.name === 'definePreview' &&
      decl.arguments[0] &&
      t.isObjectExpression(decl.arguments[0])
    ) {
      return decl.arguments[0]
    }
  }
  return null
}

function isFactoriesPreview(parsed: ConfigFile): boolean {
  for (const stmt of parsed._ast.program.body) {
    if (!t.isExportDefaultDeclaration(stmt)) continue
    let decl: t.Node = stmt.declaration
    if (t.isTSSatisfiesExpression(decl) || t.isTSAsExpression(decl)) decl = decl.expression
    if (
      t.isCallExpression(decl) &&
      t.isIdentifier(decl.callee) &&
      decl.callee.name === 'definePreview'
    ) {
      return true
    }
  }
  return false
}

// -------- move `initialize` to the `/csf3` subpath
//
// Splits the named `initialize` specifier off the `msw-storybook-addon`
// import onto its own `import { initialize } from 'msw-storybook-addon/csf3'`.
// Aliases (`initialize as init`) are preserved. If the import had no other
// specifiers, its source is rewritten in place instead of leaving an empty
// declaration. Idempotent: a `/csf3` import is left untouched (the loop
// only matches `ADDON_PACKAGE`).

function moveInitializeToCsf3(parsed: ConfigFile): boolean {
  let changed = false
  for (const stmt of parsed._ast.program.body) {
    if (!t.isImportDeclaration(stmt)) continue
    if (stmt.source.value !== ADDON_PACKAGE) continue

    const initSpec = stmt.specifiers.find(
      (s): s is t.ImportSpecifier =>
        t.isImportSpecifier(s) && importedName(s) === 'initialize',
    )
    if (!initSpec) continue

    if (stmt.specifiers.length === 1) {
      // Only `initialize` — just retarget this declaration.
      stmt.source = t.stringLiteral(CSF3_SUBPATH)
    } else {
      // Peel `initialize` off and add a dedicated `/csf3` import.
      stmt.specifiers = stmt.specifiers.filter((s) => s !== initSpec)
      mergeInitializeImport(parsed, initSpec)
    }
    changed = true
  }
  return changed
}

function mergeInitializeImport(
  parsed: ConfigFile,
  initSpec: t.ImportSpecifier,
): void {
  // Reuse an existing `/csf3` import if there already is one.
  for (const stmt of parsed._ast.program.body) {
    if (!t.isImportDeclaration(stmt)) continue
    if (stmt.source.value !== CSF3_SUBPATH) continue
    const has = stmt.specifiers.some(
      (s) => t.isImportSpecifier(s) && importedName(s) === 'initialize',
    )
    if (!has) stmt.specifiers.push(initSpec)
    return
  }
  parsed._ast.program.body.unshift(
    t.importDeclaration([initSpec], t.stringLiteral(CSF3_SUBPATH)),
  )
}

// -------- drop `mswLoader`/`mswDecorator` from `loaders`/`decorators`

function stripMswRef(
  obj: t.ObjectExpression,
  propName: string,
  refName: string,
): boolean {
  const prop = findProperty(obj, propName)
  if (!prop) return false
  const value = prop.value
  // `loaders: mswLoader` / `decorators: mswDecorator` (single value)
  if (t.isIdentifier(value) && value.name === refName) {
    obj.properties = obj.properties.filter((p) => p !== prop)
    return true
  }
  // `loaders: [mswLoader, ...others]`
  if (t.isArrayExpression(value)) {
    const before = value.elements.length
    value.elements = value.elements.filter(
      (el) => !(el && t.isIdentifier(el) && el.name === refName),
    )
    if (value.elements.length === 0 && before > 0) {
      // Nothing left — remove the whole property.
      obj.properties = obj.properties.filter((p) => p !== prop)
      return true
    }
    return value.elements.length !== before
  }
  return false
}

// -------- factories: ensure mswAddon() is in addons array

function ensureFactoriesAddonRegistered(
  parsed: ConfigFile,
  configObj: t.ObjectExpression,
): boolean {
  let changed = false
  // Find the default-export identifier name for msw-storybook-addon, if any.
  let mswAddonLocalName: string | null = null
  for (const stmt of parsed._ast.program.body) {
    if (!t.isImportDeclaration(stmt)) continue
    if (stmt.source.value !== ADDON_PACKAGE) continue
    for (const spec of stmt.specifiers) {
      if (t.isImportDefaultSpecifier(spec)) {
        mswAddonLocalName = spec.local.name
      }
    }
  }
  // If no default import exists, inject one (prefer reusing an existing
  // msw-storybook-addon import declaration if one is still around).
  if (!mswAddonLocalName) {
    mswAddonLocalName = 'mswAddon'
    let attached = false
    for (const stmt of parsed._ast.program.body) {
      if (!t.isImportDeclaration(stmt)) continue
      if (stmt.source.value !== ADDON_PACKAGE) continue
      stmt.specifiers.unshift(t.importDefaultSpecifier(t.identifier('mswAddon')))
      attached = true
      changed = true
      break
    }
    if (!attached) {
      parsed._ast.program.body.unshift(
        t.importDeclaration(
          [t.importDefaultSpecifier(t.identifier('mswAddon'))],
          t.stringLiteral(ADDON_PACKAGE),
        ),
      )
      changed = true
    }
  }

  // Now make sure `addons` exists and contains `mswAddon()`.
  let addonsProp = findProperty(configObj, 'addons')
  if (!addonsProp) {
    const arr = t.arrayExpression([
      t.callExpression(t.identifier(mswAddonLocalName), []),
    ])
    configObj.properties.unshift(t.objectProperty(t.identifier('addons'), arr))
    return true
  }
  if (!t.isArrayExpression(addonsProp.value)) return changed
  const already = addonsProp.value.elements.some((el) => {
    if (!el) return false
    // mswAddon() — call expression with our identifier as callee
    if (
      t.isCallExpression(el) &&
      t.isIdentifier(el.callee) &&
      el.callee.name === mswAddonLocalName
    )
      return true
    // bare identifier mswAddon — unusual but acceptable
    if (t.isIdentifier(el) && el.name === mswAddonLocalName) return true
    return false
  })
  if (!already) {
    addonsProp.value.elements.unshift(
      t.callExpression(t.identifier(mswAddonLocalName), []),
    )
    return true
  }
  return changed
}

// -------- helpers

function findProperty(obj: t.ObjectExpression, name: string): t.ObjectProperty | undefined {
  for (const prop of obj.properties) {
    if (!t.isObjectProperty(prop)) continue
    const key = prop.key
    if (t.isIdentifier(key) && key.name === name) return prop
    if (t.isStringLiteral(key) && key.value === name) return prop
  }
  return undefined
}
