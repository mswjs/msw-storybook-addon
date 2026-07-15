import type { Preview } from '@storybook/react-vite'
import { http, HttpResponse } from 'msw'
import { mswLoader } from 'msw-storybook-addon/csf3'

export default {
  loaders: [mswLoader()],
  parameters: {
    msw: [
      http.get('https://api.example.com/user', () => {
        return HttpResponse.json({
          name: 'John Maverick (preview parameters)'
        })
      })
    ]
  }
} satisfies Preview
