import { definePreview } from '@storybook/react-vite'
import { network } from 'virtual:msw'
import addonMsw from 'msw-storybook-addon'
import { http, HttpResponse } from 'msw/http'

export default definePreview({
  addons: [
    addonMsw(async () => {
      network.configure({
        context: {
          quiet: true
        }
      })
      await network.enable()
      return network
    })
  ],
  beforeEach({ msw }) {
    msw.use(
      http.get('https://api.example.com/user', () => {
        return HttpResponse.json({
          name: 'John Maverick (preview beforeEach)'
        })
      })
    )
  }
})
