import type { Preview } from '@storybook/react-vite'
import { mswLoader } from 'msw-storybook-addon/csf3'

export default {
  loaders: [mswLoader()]
} satisfies Preview
