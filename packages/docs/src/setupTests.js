import '@testing-library/jest-dom';

// TODO: Fix the tests. Seems like it will only work properly once moved to Vitest or away from CRA.
import { ArrayBuffer, TextDecoder, TextEncoder, Uint8Array } from 'util';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
global.ArrayBuffer = ArrayBuffer;
global.Uint8Array = Uint8Array;

// eslint-disable-next-line import/first
const { startServer } = require('./test-utils')

const server = startServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
