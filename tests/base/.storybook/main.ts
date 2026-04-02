import { StorybookConfig } from '@storybook/react-vite'

export default {
  framework: '@storybook/react-vite',
  stories: ['../stories/**/*.stories.tsx'],
  addons: ['@msw/storybook', '@storybook/addon-vitest'],
  staticDirs: ['../../public'],
} satisfies StorybookConfig
