import type { RequestHandler, SetupApi, LifeCycleEventsMap } from 'msw'
import type { SetupWorker } from 'msw/browser'
import type { SetupServer } from 'msw/node'

export declare var api: SetupApi<LifeCycleEventsMap>

export type InitializeOptions =
  | Parameters<SetupServer['listen']>[0]
  | Parameters<SetupWorker['start']>[0]

export declare function initialize(
  options?: InitializeOptions,
  initialHandlers?: RequestHandler[]
): SetupApi<LifeCycleEventsMap>
