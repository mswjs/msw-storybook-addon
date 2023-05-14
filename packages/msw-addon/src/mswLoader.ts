import { isNodeProcess } from 'is-node-process';
import { SetupWorkerApi, RequestHandler, rest } from 'msw';
import type { SetupServerApi } from 'msw/node';

export type SetupApi = SetupWorkerApi | SetupServerApi;
export type InitializeOptions =
  | Parameters<SetupWorkerApi['start']>[0]
  | Parameters<SetupServerApi['listen']>[0];

export type MswParameters = {
  msw?:
    | RequestHandler[]
    | {
        handlers: RequestHandler[] | Record<string, RequestHandler>;
      };
  mswPanelState?: {
    api?: SetupApi;
    handlers?: RequestHandler[];
    responseMap?: Map<string, Response>;
  };
};

type Context = {
  parameters: MswParameters;
};

const IS_BROWSER = !isNodeProcess();
let api: SetupApi;
let workerPromise: Promise<unknown>;

export async function initialize(options?: InitializeOptions): Promise<SetupApi> {
  const defaultHandlers = [
    rest.get('/hot-update/*', (req) => req.passthrough()),
    rest.get('/node_modules/*', (req) => req.passthrough()),
  ];

  if (IS_BROWSER) {
    const { setupWorker } = await import('msw');
    const worker = setupWorker(...defaultHandlers);
    workerPromise = worker.start(options);
    api = worker as SetupApi;
  } else {
    const { setupServer } = await import('msw/node');
    const server = setupServer(...defaultHandlers);
    workerPromise = Promise.resolve(server.listen(options));
    api = server as SetupApi;
  }

  return api;
}

export function getWorker(): SetupApi {
  if (api === undefined) {
    throw new Error(
      `[MSW] Failed to retrieve the worker: no active worker found. Did you forget to call "initialize"?`
    );
  }

  return api;
}

const setupHandlers = (msw: MswParameters['msw']) => {
  if (api) {
    if (window.__MSW_STORYBOOK__) return;

    api.resetHandlers();

    if (msw) {
      if (Array.isArray(msw) && msw.length > 0) {
        // Support an Array of request handlers (backwards compatibility).
        api.use(...msw);
      } else if ('handlers' in msw && msw.handlers) {
        // Support an Array named request handlers handlers
        // or an Object of named request handlers with named arrays of handlers
        const handlers = Object.values(msw.handlers)
          .filter(Boolean)
          .reduce(
            (handlers, handlersList) => handlers.concat(handlersList),
            [] as RequestHandler[]
          );

        if (handlers.length > 0) {
          api.use(...handlers);
        }
      }
    }
  }
};

/**
 * @deprecated Use mswLoader instead, as it is much more reliable.
 * ```diff
 * - import { mswDecorator } from 'msw-storybook-addon';
 * + import { mswLoader } from 'msw-storybook-addon';
 *
 * - export const decorators = [mswDecorator];
 * + export const loaders = [mswLoader];
 * ```
 */
export const mswDecorator = <Story extends (...args: any[]) => any>(
  storyFn: Story,
  context: Context
) => {
  // console.warn(
  //   `[MSW] "mswDecorator" is now deprecated, please check the migration guide at: TODO`
  // )

  const {
    parameters: { msw },
  } = context;

  setupHandlers(msw);

  return storyFn();
};

export const mswLoader = async (context: Context) => {
  const {
    parameters: { msw },
  } = context;

  if (!msw) return;

  setupHandlers(msw);

  if (workerPromise) {
    await workerPromise;
    window.__MSW_STORYBOOK__ = window.__MSW_STORYBOOK__ || {};
    // @ts-expect-error the types are getting confused, we will eventually remove setupServerApi
    window.__MSW_STORYBOOK__.worker = api;
  }
  return {};
};
