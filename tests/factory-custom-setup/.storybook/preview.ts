import { definePreview } from '@storybook/react-vite'
import addonMsw from 'msw-storybook-addon'
import { http, HttpResponse } from 'msw/http'

export default definePreview({
  addons: [
    addonMsw(async () => {
      const { network } = await import('virtual:msw')

      network.configure({
        handlers: [
          http.get('https://api.example.com/user', () => {
            return HttpResponse.json({
              name: 'Custom Setup User (custom setup)'
            })
          })
        ],
        onUnhandledFrame: 'bypass'
      })

      await network.enable()

      return network
    })
  ]
})
