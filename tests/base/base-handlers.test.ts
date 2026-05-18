import { test, expect } from '@playwright/test'

test('uses the handlers from preview', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Preview Handlers' }).click()

  const iframe = page.frameLocator('#storybook-preview-iframe')
  await expect(iframe.getByRole('paragraph')).toHaveText(
    'handler defined in preview beforeEach',
  )
})

test('supports story-level handler overrides', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Per-Story Handlers' }).click()

  const iframe = page.frameLocator('#storybook-preview-iframe')
  await expect(iframe.getByRole('paragraph')).toHaveText(
    'handler overriden in story beforeEach',
  )
})

test('legacy handler defined in story with parameters.msw still works', async ({
  page,
}) => {
  await page.goto('/')
  await page
    .getByRole('link', { name: 'Legacy parameters.msw (object form)' })
    .click()

  const iframe = page.frameLocator('#storybook-preview-iframe')
  await expect(iframe.getByRole('paragraph')).toHaveText(
    'legacy handler defined in story with parameters.msw',
  )
})

test('legacy handler defined in story with parameters.msw array form still works', async ({
  page,
}) => {
  await page.goto('/')
  await page
    .getByRole('link', { name: 'Legacy parameters.msw (array form)' })
    .click()

  const iframe = page.frameLocator('#storybook-preview-iframe')
  await expect(iframe.getByRole('paragraph')).toHaveText(
    'legacy handler defined in story with parameters.msw array form',
  )
})

// Precedence footgun #1: `parameters.msw` and `beforeEach({ msw })` in the
// same story — the deprecated param wins (decorator runs after beforeEach).
test('parameters.msw beats beforeEach in the same story', async ({ page }) => {
  await page.goto('/')
  await page
    .getByRole('link', { name: 'parameters.msw + beforeEach (same story)' })
    .click()

  const iframe = page.frameLocator('#storybook-preview-iframe')
  await expect(iframe.getByRole('paragraph')).toHaveText('parameters.msw wins')
})

// Precedence footgun #2: a broad (meta-level) legacy `parameters.msw`
// default silently overrides a migrated story-level `beforeEach({ msw })`.
test('meta parameters.msw default beats a story beforeEach override', async ({
  page,
}) => {
  await page.goto('/')
  await page
    .getByRole('link', { name: 'story beforeEach under meta parameters.msw' })
    .click()

  const iframe = page.frameLocator('#storybook-preview-iframe')
  await expect(iframe.getByRole('paragraph')).toHaveText(
    'meta parameters.msw default',
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
