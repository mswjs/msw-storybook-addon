import type { RequestHandler } from 'msw'
import { SetupServer } from 'msw/node'
import { setupServer } from 'msw/native'

export let api: SetupServer

export type InitializeOptions = Parameters<SetupServer['listen']>[0]

export function initialize(
  options?: InitializeOptions,
  initialHandlers: RequestHandler[] = []
): SetupServer {
  const server = setupServer(...initialHandlers)
  server.listen(options)
  api = server
  return server
}
