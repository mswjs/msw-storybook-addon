import { addons, useChannel } from '@storybook/preview-api';
import type {
  Renderer,
  PartialStoryFn as StoryFunction,
} from '@storybook/types';
import {
  STORY_CHANGED,
  FORCE_REMOUNT,
  STORY_ARGS_UPDATED,
} from '@storybook/core-events';
import { EVENTS } from './constants';
import { RequestHandler, RestRequest, graphql, rest } from 'msw';
import { MswParameters } from './mswLoader';
import { getResponse } from './utils/getResponse';

type Context = {
  [x: string]: any;
  parameters: MswParameters;
};

const channel = addons.getChannel();
let INITIAL_MOUNT_STATE = true;
let delay = 0;
let status = 200;
let moveTimeout: NodeJS.Timeout;
let emit: (eventName: string, ...args: any) => void;

const updateHandlers = () => {
  if (!Object.keys((window as any).msw.handlersMap).length) return;

  if (!(window as any).msw) return;
  const worker = (window as any).msw.worker;
  // worker.resetHandlers();
  (window as any).msw.handlers?.forEach(
    (handler: {
      info: { header: string; path?: string; operationName?: string };
    }) => {
      if (!(window as any).msw.handlersMap[handler.info.header]) return;
      const currentResponse = (window as any).msw.handlersMap[
        handler.info.header
      ].response;

      if (handler.info.path)
        worker.use(
          rest.get(handler.info.path, (req, res, ctx) => {
            return res(
              ctx.status(status),
              ctx.delay(delay),
              ctx.json(JSON.parse(currentResponse.body))
            );
          })
        );
      else if (handler.info.operationName)
        worker.use(
          graphql.query(handler.info.operationName, (req, res, ctx) => {
            return res(
              ctx.status(status),
              ctx.delay(delay),
              currentResponse.body.includes('errors')
                ? ctx.errors([...JSON.parse(currentResponse.body).errors])
                : ctx.data(JSON.parse(currentResponse.body).data)
            );
          })
        );
    }
  );
};

export const withRoundTrip = (
  storyFn: StoryFunction<Renderer>,
  ctx: Context
) => {
  if (!ctx.parameters.msw) return storyFn();

  if (!(window as any).msw) {
    channel.emit(FORCE_REMOUNT, { storyId: ctx.id });
    return storyFn();
  }

  if ('handlers' in ctx.parameters.msw) {
    // Get handlers from story parameters
    if (!(window as any).msw.handlers)
      (window as any).msw.handlers = ctx.parameters.msw
        .handlers as RequestHandler[];

    // Initialize handlersMap to store responses
    if (!(window as any).msw.handlersMap) (window as any).msw.handlersMap = {};

    // Define events to listen to from the addon panel
    emit = useChannel({
      [EVENTS.UPDATE]: ({ key, value }) => {
        if (key === 'delay') {
          clearTimeout(moveTimeout);
          delay = value;
          updateHandlers();
          moveTimeout = setTimeout(() => {
            channel.emit(FORCE_REMOUNT, { storyId: ctx.id });
          }, 500);
        }
        if (key === 'status') {
          status = value;
          updateHandlers();
          channel.emit(FORCE_REMOUNT, { storyId: ctx.id });
        }
        const responseObject = {
          delay: delay,
          status: status,
          responses: (window as any).msw.handlersMap,
        };
        emit(EVENTS.SEND, responseObject);
      },
      [EVENTS.UPDATE_RESPONSES]: ({ key, objectKey, objectValue }) => {
        if (key === 'responses') {
          (window as any).msw.handlersMap[objectKey].response.body =
            JSON.stringify(objectValue);
          updateHandlers();
          const responseObject = {
            delay: delay,
            status: status,
            responses: (window as any).msw.handlersMap,
          };
          channel.emit(FORCE_REMOUNT, { storyId: ctx.id });
          emit(EVENTS.SEND, responseObject);
        }
      },
      [EVENTS.RESET]: () => {
        delete (window as any).msw.handlersMap;
        (window as any).msw.worker.stop();

        location.reload();
      },
    });

    // If this is the first time the story is mounted, send the initial state to the addon panel
    if (INITIAL_MOUNT_STATE) {
      logEvents();
      emit(EVENTS.SEND, {
        delay: delay,
        status: status,
        responses: (window as any).msw.handlersMap,
      });
      channel.on(STORY_ARGS_UPDATED, () => {
        delete (window as any).msw.handlersMap;
        location.reload();
      });
      channel.on(STORY_CHANGED, () => {
        emit(EVENTS.SEND, {
          status: undefined,
          delay: undefined,
          responses: undefined,
        });
        delete (window as any).msw.handlersMap;
        (window as any).msw.worker.stop();
        location.reload();
      });
      INITIAL_MOUNT_STATE = false;
      channel.emit(FORCE_REMOUNT, { storyId: ctx.id });
    }
  }

  return storyFn();
};

// Listen to request:match events from msw in order to build the handlersMap
const logEvents = () => {
  const worker = (window as any).msw.worker;
  if (!Array.isArray((window as any).msw.handlers)) {
    const joinedHandlers: any = [];
    Object.values((window as any).msw.handlers).forEach((handler) => {
      if (Array.isArray(handler)) joinedHandlers.push(...handler);
      else joinedHandlers.push(handler);
    });

    (window as any).msw.handlers = joinedHandlers;
  }

  //SUGGESTION: return both the request and the handler for a matched request
  //WORKAROUND: use msw's getResponse function as a utility to get the handler
  (worker.events as any).on('request:match', async (req: RestRequest) => {
    const { handler, response } = await getResponse(
      req,
      (window as any).msw.handlers
    );

    if (response && handler) {
      if (
        (window as any).msw.handlersMap[handler.info.header] &&
        (window as any).msw.handlersMap[handler.info.header].response
      ) {
        response.body = (window as any).msw.handlersMap[
          handler.info.header
        ].response.body;
      }

      (window as any).msw.handlersMap[handler.info.header] = {
        handler: handler,
        response: { ...response, delay: delay, status: status },
      };
      updateHandlers();
      emit(EVENTS.SEND, {
        delay: delay,
        status: status,
        responses: (window as any).msw.handlersMap,
      });
    }
  });
};
