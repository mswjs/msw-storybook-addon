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
import { EVENTS, PARAM_KEY } from './constants';
import { RequestHandler, RestRequest, graphql, rest } from 'msw';
import { MswParameters, SetupApi } from './mswLoader';
import { getResponse } from './utils/getResponse';

type Context = {
  [x: string]: any;
  parameters: MswParameters;
};

const channel = addons.getChannel();
let INITIAL_MOUNT_STATE = true;
let delay = 500;
let status = 200;
let moveTimeout: NodeJS.Timeout;
let emit: (eventName: string, ...args: any) => void;

const updateHandlers = () => {
  if (!(window as any).msw) return;
  const worker = (window as any).msw;
  worker.resetHandlers();
  (window as any).handlers?.forEach(
    (handler: {
      info: { header: string; path?: string; operationName?: string };
    }) => {
      const currentResponse = (window as any).mswRequests.get(
        handler.info.header
      ).response;
      console.log(handler.info, currentResponse);
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
              ctx.data(JSON.parse(currentResponse.body).data)
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
    if (!(window as any).handlers)
      (window as any).handlers = ctx.parameters.msw
        .handlers as RequestHandler[];
    if (!(window as any).mswRequests) (window as any).mswRequests = new Map();

    emit = useChannel({
      [EVENTS.UPDATE]: ({ key, value }) => {
        if (key === 'delay') {
          clearTimeout(moveTimeout);
          delay = value;
          updateHandlers();
          moveTimeout = setTimeout(() => {
            channel.emit(FORCE_REMOUNT, { storyId: ctx.id });
          }, 300);
        }
        if (key === 'status') {
          status = value;
          updateHandlers();
          channel.emit(FORCE_REMOUNT, { storyId: ctx.id });
        }
        const responseObject = {
          delay: delay,
          status: status,
        };
        emit(EVENTS.SEND, responseObject);
      },
    });

    if (INITIAL_MOUNT_STATE) {
      logEvents();
      emit(EVENTS.SEND, {
        delay: delay,
        status: status,
      });
      channel.on(STORY_ARGS_UPDATED, () => {
        delete (window as any).mswRequests;
        location.reload();
      });
      channel.on(STORY_CHANGED, () => {
        delete (window as any).mswRequests;
        (window as any).msw.stop();
        location.reload();
      });
      INITIAL_MOUNT_STATE = false;
      channel.emit(FORCE_REMOUNT, { storyId: ctx.id });
    }
  }

  return storyFn();
};

const logEvents = () => {
  const worker = (window as any).msw;
  (worker.events as any).on('request:match', async (req: RestRequest) => {
    const { handler, response } = await getResponse(
      req,
      (window as any).handlers
    );
    if (response && handler) {
      (window as any).mswRequests.set(handler.info.header, {
        handler: handler,
        response: { ...response, delay: delay, status: status },
      });
      updateHandlers();
    }
  });
};
