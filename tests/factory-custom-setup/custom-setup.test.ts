import * as fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test, expect } from '@playwright/test'

const mswWorkerScript = fs.readFileSync(
  fileURLToPath(import.meta.resolve('msw/mockServiceWorker.js')),
  'utf8'
)

test('resolves requests against the worker created by the custom setup function', async ({
  page
}) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Custom Setup' }).click()

  const iframe = page.frameLocator('#storybook-preview-iframe')
  await expect(iframe.getByRole('paragraph')).toHaveText(
    'Custom Setup User (custom setup)'
  )
})

test('serves the worker script through the msw/vite plugin', async ({
  request
}) => {
  const response = await request.get('/mockServiceWorker.js')

  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toMatch(/javascript/)
  await expect(response.text()).resolves.toBe(mswWorkerScript)
})
