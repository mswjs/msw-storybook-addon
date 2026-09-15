import { createPreviewAnnotations } from './addon'

export { createPreviewAnnotations }

// Storybook's automigrations (`storybook add`, `automigrate csf-factories`)
// wire third-party addons as `import * as addon from '<name>/preview'` and
// `addons: [addon]`. They only read annotations from the namespace itself or
// its `default` export, so a named factory alone is never picked up.
export default createPreviewAnnotations()
