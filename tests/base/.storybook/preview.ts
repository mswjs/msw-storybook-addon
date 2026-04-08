import { definePreview } from '@storybook/react-vite'
import addonMsw from 'msw-storybook-addon'
import { http, HttpResponse } from 'msw'

export default definePreview({
  addons: [addonMsw()],
  beforeEach({ msw }) {
    msw.use(
      http.get('https://api.example.com/user', () => {
        return HttpResponse.json({ name: 'John Maverick' })
      }),
    )
  },
})
