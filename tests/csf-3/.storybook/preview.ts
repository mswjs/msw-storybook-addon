import { http, HttpResponse } from 'msw'
import type { ProjectAnnotations, Renderer } from 'storybook/internal/types'

export default {
  beforeEach({ msw }) {
    msw.use(
      http.get('https://api.example.com/user', () => {
        return HttpResponse.json({ name: 'John Maverick' })
      }),
    )
  },
} satisfies ProjectAnnotations<Renderer>
