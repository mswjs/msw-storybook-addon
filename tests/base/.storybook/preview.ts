import { definePreview } from '@storybook/react-vite'
import mswAddon from '@msw/storybook'
import { http, HttpResponse } from 'msw'

export default definePreview({
  addons: [mswAddon()],
  beforeEach({ msw }) {
    msw.use(
      http.get('https://api.example.com/user', () => {
        return HttpResponse.json({ name: 'John Maverick' })
      }),
    )
  },
})
