import * as fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test, expect } from '@playwright/test'

const mswWorkerScript = fs.readFileSync(
  fileURLToPath(import.meta.resolve('msw/mockServiceWorker.js')),
  'utf8'
)

test('uses the handlers from preview', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Preview Handlers' }).click()

  const iframe = page.frameLocator('#storybook-preview-iframe')
  await expect(iframe.getByRole('paragraph')).toHaveText(
    'John Maverick (preview parameters)'
  )
})

test('supports story-level handler overrides', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Per-Story Handlers' }).click()

  const iframe = page.frameLocator('#storybook-preview-iframe')
  await expect(iframe.getByRole('paragraph')).toHaveText(
    'Alice Sunwell (story parameters)'
  )
})

test('supports mocking an infinite loading state', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Loading State' }).click()

  const iframe = page.frameLocator('#storybook-preview-iframe')
  await expect(iframe.getByRole('paragraph')).toHaveText('Loading...')

  await page.waitForTimeout(500)
  await expect(iframe.getByRole('paragraph')).toHaveText('Loading...')
})

test('uses the record-form handlers from meta', async ({ page }) => {
  await page.goto('/iframe.html?id=parameters--meta-parameters')

  await expect(page.getByRole('paragraph')).toHaveText(
    'John Maverick (meta parameters)'
  )
})

test('supports overriding a single key of the handlers record', async ({
  page
}) => {
  await page.goto('/iframe.html?id=parameters--story-override')

  await expect(page.getByRole('paragraph')).toHaveText(
    'Alice Sunwell (story parameters)'
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
