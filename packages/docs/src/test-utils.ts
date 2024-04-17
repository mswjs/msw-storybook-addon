import { setupServer } from 'msw/node';

let server: any;

export function startServer() {
  server = setupServer();
  return server;
}

export function getServer() {
  return server;
}
