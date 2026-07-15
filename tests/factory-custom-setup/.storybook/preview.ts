import { definePreview } from '@storybook/react-vite'
import addonMsw from 'msw-storybook-addon'
import { http, HttpResponse } from 'msw'

export default definePreview({
  addons: [
    addonMsw(async () => {
      const { setupWorker } = await import('msw/browser')

      const worker = setupWorker(
        http.get('https://api.example.com/user', () => {
          return HttpResponse.json({
            name: 'Custom Setup User (custom setup)'
          })
        })
      )

      await worker.start({
        quiet: true,
        onUnhandledRequest: 'bypass'
      })

      return worker
    })
  ]
})
