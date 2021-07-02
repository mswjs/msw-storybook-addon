import { SetupWorkerApi } from "msw";
import { SetupServerApi } from "msw/node";

export declare const mswDecorator: any
export declare const initializeWorker: (options?: Parameters<SetupWorkerApi['start']>[0] | Parameters<SetupServerApi['listen']>[0]) => void;