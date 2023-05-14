import type { RequestHandler, SetupWorkerApi, MockedResponse } from 'msw'

declare global {
  interface Window {
    __MSW_STORYBOOK__: {
      worker: SetupWorkerApi
      handlers: RequestHandler[]
      handlersMap: {
        [key: string]: {
          handler: RequestHandler
          response: MockedResponse
        }
      }
    }
  }
}
