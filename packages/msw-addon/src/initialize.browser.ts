import type { RequestHandler } from "msw";
import { setupWorker } from "msw/browser";
import { augmentInitializeOptions } from "./augmentInitializeOptions.js";

type SetupWorker = ReturnType<typeof setupWorker>;

export let api: SetupWorker;

export type InitializeOptions = Parameters<SetupWorker["start"]>[0];

let activationPromise: Promise<void>;

export function initialize(
  options?: InitializeOptions,
  initialHandlers: RequestHandler[] = []
): SetupWorker {
  const worker = setupWorker(...initialHandlers);
  activationPromise = worker
    .start(augmentInitializeOptions(options))
    .then(() => {});
  api = worker;
  return worker;
}

export async function waitForMswReady() {
  getWorker();
  await activationPromise;
}

export function getWorker(): SetupWorker {
  if (api === undefined) {
    throw new Error(
      `[MSW] Failed to retrieve the worker: no active worker found. Did you forget to call "initialize"?`
    );
  }

  return api;
}
