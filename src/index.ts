import { definePreviewAddon } from 'storybook/internal/csf'
import { createPreviewAnnotations, type SetupFunction } from './addon'
export { type MswApi } from './shared'

export default function addonMsw(setup?: SetupFunction) {
  return definePreviewAddon(createPreviewAnnotations(setup))
}
