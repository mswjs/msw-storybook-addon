import type { RequestHandler } from 'msw'
import { setupWorker } from 'msw/browser'
import { augmentInitializeOptions } from './augmentInitializeOptions.js'

type SetupWorker = ReturnType<typeof setupWorker>

export let api: SetupWorker

type ContextfulWorker = SetupWorker & {
  context: { isMockingEnabled: boolean; activationPromise?: any }
}

export type InitializeOptions = Parameters<SetupWorker['start']>[0]

export function initialize(
  options?: InitializeOptions,
  initialHandlers: RequestHandler[] = []
): SetupWorker {
  const worker = setupWorker(...initialHandlers) as ContextfulWorker
  worker.context.activationPromise = worker.start(
    augmentInitializeOptions(options)
  )
  api = worker
  return worker
}

export async function waitForMswReady() {
  const msw = getWorker() as ContextfulWorker
  await msw.context.activationPromise
}

export function getWorker(): SetupWorker {
  if (api === undefined) {
    throw new Error(
      `[MSW] Failed to retrieve the worker: no active worker found. Did you forget to call "initialize"?`
    )
  }

  return api
}
