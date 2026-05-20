import { type Preview } from '@storybook/react-vite'
import { http, HttpResponse } from 'msw'
import { withMsw } from 'msw-storybook-addon/csf3'

export default {
  decorators: [
    withMsw(
      {
        onUnhandledRequest: 'bypass',
        quiet: true,
      },
      [
        http.get('https://api.example.com/user', () => {
          return HttpResponse.json({ name: 'John Maverick' })
        }),
      ],
    ),
  ],
} satisfies Preview
