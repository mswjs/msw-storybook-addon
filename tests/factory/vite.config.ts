import { msw } from 'msw/vite'

export default {
  plugins: [msw({ mode: 'worker-only' })]
}
