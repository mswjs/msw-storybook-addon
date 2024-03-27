// TODO: Fix the tests. Seems like it will only work properly once moved to Vitest or away from CRA.
const { clearImmediate } = require('timers')
const { TextDecoder, TextEncoder } = require('util')

Object.defineProperties(global, {
  TextDecoder: {
    value: TextDecoder,
  },
  TextEncoder: {
    value: TextEncoder,
  },
  clearImmediate: {
    value: clearImmediate,
  },
})

/**
 * We purposely import this _after_ setting the TextEncoder and TextDecoder
 * otherwise they won't be accessible from internal undici modules
 */
const { fetch, FormData, Headers, Request, Response, setGlobalOrigin } = require('undici')

/**
 * Setting the global origin for requests so that relative urls work in our jest tests
 */
setGlobalOrigin(window.location.origin)

Object.defineProperties(global, {
  fetch: {
    value: fetch,
    writable: true,
  },
  FormData: {
    value: FormData,
  },
  Headers: {
    value: Headers,
  },
  Request: {
    value: Request,
  },
  Response: {
    value: Response,
  },
})
