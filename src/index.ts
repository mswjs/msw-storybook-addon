import { definePreviewAddon } from 'storybook/internal/csf'
import { createPreviewAnnotations } from './preview'
import type { MswApi } from './preview'

export default (setup?: () => MswApi | Promise<MswApi>) =>
  definePreviewAddon(createPreviewAnnotations(setup))
