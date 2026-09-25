import { type StorybookConfig } from '@storybook/react-vite'
import { msw } from 'msw/vite'

export default {
  framework: '@storybook/react-vite',
  stories: ['../stories/**/*.stories.tsx'],
  addons: ['msw-storybook-addon'],
  viteFinal(config) {
    config.plugins ??= []
    config.plugins.push(msw())
    return config
  }
} satisfies StorybookConfig
