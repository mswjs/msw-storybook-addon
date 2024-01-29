import type { RequestHandler } from 'msw'
import type { SetupServer } from 'msw/node'
import { setupServer } from 'msw/node'
import { augmentInitializeOptions } from './augmentInitializeOptions'

export let api: SetupServer

export type InitializeOptions = Parameters<SetupServer['listen']>[0]

export function initialize(
  options?: InitializeOptions,
  initialHandlers: RequestHandler[] = []
): SetupServer {
  const server = setupServer(...initialHandlers)
  server.listen(augmentInitializeOptions(options))
  api = server
  return server
}

export function getWorker(): SetupServer {
  if (api === undefined) {
    throw new Error(
      `[MSW] Failed to retrieve the worker: no active worker found. Did you forget to call "initialize"?`
    )
  }

  return api
}