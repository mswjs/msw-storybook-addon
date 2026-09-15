import { definePreview } from '@storybook/react-vite'
import addonMsw from 'msw-storybook-addon'

export default definePreview({
  addons: [addonMsw()]
})
