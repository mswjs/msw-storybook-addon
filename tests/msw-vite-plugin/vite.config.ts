import { msw } from 'msw/vite'

// Storybook loads the project's Vite config automatically, the same way it
// picks up an application's `vite.config.ts`, so the plugin is registered
// once for the app and Storybook alike.
export default {
  plugins: [msw()]
}
