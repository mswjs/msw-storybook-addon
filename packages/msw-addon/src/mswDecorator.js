import { makeDecorator } from '@storybook/addons'
import { setupWorker } from 'msw'

const IS_BROWSER = typeof global.process === 'undefined'

export let worker

export const mswDecorator = (options) => {
  if (IS_BROWSER) {
    worker = setupWorker()
    worker.start(options)
  }

  return makeDecorator({
    name: 'withMsw',
    parameterName: 'api',
    wrapper(storyFn, context, { handlers = [] }) {
      if (worker) {
        worker.resetHandlers()
        worker.use(...handlers)
      }

      return storyFn(context)
    },
  })
}
