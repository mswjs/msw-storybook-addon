import { http, HttpResponse } from 'msw'
import { initialize } from 'msw-storybook-addon/csf3'

// Exercise the CSF3 `initialize()` customization entry point: explicit
// StartOptions + initial handlers passed at worker construction time.
// `initialize(opts, [handler])` registers the handler on `setupWorker(...)`,
// so it survives `resetHandlers()` between stories — i.e. it's a true
// "preview-level default", not an `msw.use(...)` override.
initialize({ onUnhandledRequest: 'bypass', quiet: true }, [
  http.get('https://api.example.com/user', () => {
    return HttpResponse.json({
      name: 'initial handler defined in initialize() function',
    })
  }),
])

export default {
  tags: ['autodocs'],
}
