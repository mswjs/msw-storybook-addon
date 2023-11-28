import '@testing-library/jest-dom'

// eslint-disable-next-line import/first
import { startServer } from './test-utils'

const server = startServer()

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
