import { definePreviewAddon } from 'storybook/internal/csf'
import { createPreviewAnnotations, type SetupFunction } from './addon'

export default function addonMsw(setup?: SetupFunction) {
  return definePreviewAddon(createPreviewAnnotations(setup))
}
