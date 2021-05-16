import { setupWorker } from 'msw'
import { setupServer } from 'msw/node'

export class Worker {
  constructor() {
    this.worker = setupWorker()
  }

  start(options) {
    this.worker.start(options)
  }

  use(...handlers) {
    this.worker.use(...handlers)
  }

  resetHandlers(...nextHandlers) {
    this.worker.resetHandlers(...nextHandlers)
  }

  restoreHandlers() {
    this.worker.restoreHandlers()
  }

  printHandlers() {
    this.worker.printHandlers()
  }

  stop() {
    this.worker.stop()
  }
}

export class Server {
  constructor() {
    this.server = setupServer()
  }

  start(options) {
    this.server.listen(options)
  }

  use(...handlers) {
    this.server.use(...handlers)
  }

  resetHandlers(...nextHandlers) {
    this.server.resetHandlers(...nextHandlers)
  }

  restoreHandlers() {
    this.server.restoreHandlers()
  }

  printHandlers() {
    this.server.printHandlers()
  }

  stop() {
    this.server.close()
  }
}

const IS_BROWSER = typeof global.process === 'undefined'

export const initializeWorkerInstance = () => (IS_BROWSER ? new Worker() : new Server())
